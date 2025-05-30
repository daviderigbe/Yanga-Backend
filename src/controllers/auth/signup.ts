import { t } from "elysia";
import { db } from "../../lib/db";
import { createBaseElysia } from "../../base";
import { randomBytes } from "crypto";
import { sendEmail } from "../../lib/email";
import { redisClient } from "../../lib/redis";

// Define an interface for the email verification data
interface EmailVerificationData {
  code: string;
  userId: string;
  email: string;
}

export const signup = createBaseElysia().post(
  "signup",
  async ({ body, set, log }) => {
    try {
      const { email, password, name, username } = body;

      // Check if email already exists
      const existingEmail = await db.user.findUnique({
        where: {
          email,
        },
      });
      if (existingEmail) {
        log.error("User with this email already exists");
        set.status = "Conflict";
        return {
          status: "error",
          message: "User with this email already exists",
        } as ApiResponse<null>;
      }

      // Check if username already exists
      const existingUsername = await db.user.findUnique({
        where: {
          userName: username,
        },
      });
      if (existingUsername) {
        log.error("User with this username already exists");
        set.status = "Conflict";
        return {
          status: "error",
          message: "User with this username already exists",
        } as ApiResponse<null>;
      }

      // Hash password and create user (emailVerified defaults to false)
      const passwordHash = await Bun.password.hash(password);
      const newUser = await db.user.create({
        data: {
          email,
          name,
          userName: username,
          password: passwordHash,
          emailVerified: false, // Explicitly set to false
        },
        select: {
          id: true,
          email: true,
          name: true,
          userName: true,
          emailVerified: true,
        },
      });

      // Generate verification code (6 digits)
      const code = randomBytes(3).toString("hex").substring(0, 6).toUpperCase();

      // Store code in Redis with 15 minute expiration
      const redisKey = `email_verification:${email}`;
      const verificationData: EmailVerificationData = {
        code,
        userId: newUser.id,
        email: newUser.email,
      };

      await redisClient.set(redisKey, JSON.stringify(verificationData), {
        EX: 15 * 60, // 15 minutes TTL
      });

      // Send verification code via email
      try {
        await sendEmail({
          to: email,
          subject: "Welcome! Please verify your email",
          body: `Welcome to our platform! Your email verification code is: ${code}. It will expire in 15 minutes. Please verify your email before logging in.`,
        });
      } catch (emailError) {
        log.error("Failed to send verification email:", emailError);
        // Continue with signup success even if email fails
        // The user can still request a new verification code later
      }

      set.status = 201;
      return {
        status: "success",
        message:
          "User created successfully. Please check your email for verification code.",
        data: {
          user: newUser,
          requiresEmailVerification: true,
        },
      } as ApiResponse<{
        user: typeof newUser;
        requiresEmailVerification: boolean;
      }>;
    } catch (error) {
      log.error("[Signup Error]:", error);

      // Determine if it's a known error type
      if (error instanceof Error) {
        set.status = 400;
        return {
          status: "error",
          message: "Invalid request data",
        } as ApiResponse<null>;
      }

      set.status = 500;
      return {
        status: "error",
        message: "An unexpected error occurred",
      } as ApiResponse<null>;
    }
  },
  {
    body: t.Object({
      name: t.String({
        minLength: 3,
        maxLength: 32,
        error: "Name must be between 3 and 32 characters long.",
      }),
      email: t.String({
        format: "email",
        error: "Invalid email address.",
      }),
      password: t.String({
        minLength: 8,
        maxLength: 64,
        error: "Password must be between 8 and 64 characters long.",
      }),
      username: t.String({
        minLength: 3,
        maxLength: 32,
        error: "Username must be between 3 and 32 characters long.",
      }),
    }),
    response: t.Object({
      status: t.Union([t.Literal("success"), t.Literal("error")]),
      message: t.String(),
      data: t.Optional(
        t.Object({
          user: t.Object({
            id: t.String(),
            email: t.String(),
            name: t.String(),
            userName: t.String(),
            emailVerified: t.Boolean(),
          }),
          requiresEmailVerification: t.Optional(t.Boolean()),
        }),
      ),
    }),
    detail: {
      tags: ["Auth"],
      summary: "Create new user account with email verification",
      description:
        "Register a new user with email, username, password and name. Sends verification email automatically.",
    },
  },
);

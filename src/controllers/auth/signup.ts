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
function validatePassword(password: string) {
  const errors: string[] = [];

  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter.");
  }
  if (!/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter.");
  }
  if (!/[0-9]/.test(password)) {
    errors.push("Password must contain at least one number.");
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    errors.push("Password must contain at least one special character.");
  }

  return errors;
}

export const signup = createBaseElysia().post(
  "signup",
  async ({ body, set, log }) => {
    const email = body.email.toLowerCase().trim();
    const username = body.username.toLowerCase().trim();

    try {
      // Password strength check
      const passwordErrors = validatePassword(body.password);
      if (passwordErrors.length > 0) {
        set.status = 400;
        return {
          status: "error",
          message: passwordErrors.join(" "),
        } as ApiResponse<null>;
      }

      // Uniqueness checks
      const [emailExists, usernameExists] = await Promise.all([
        db.user.findUnique({ where: { email } }),
        db.user.findUnique({ where: { userName: username } }),
      ]);

      if (emailExists) {
        set.status = 409;
        return {
          status: "error",
          message: "User with this email already exists.",
        } as ApiResponse<null>;
      }

      if (usernameExists) {
        set.status = 409;
        return {
          status: "error",
          message: "User with this username already exists.",
        } as ApiResponse<null>;
      }

      // Hash password
      const passwordHash = await Bun.password.hash(body.password);

      const user = await db.user.create({
        data: {
          email,
          name: body.name,
          userName: username,
          password: passwordHash,
          emailVerified: false,
        },
        select: {
          id: true,
          email: true,
          name: true,
          userName: true,
          emailVerified: true,
        },
      });

      // Generate verification code
      const code = randomBytes(3).toString("hex").toUpperCase();

      redisClient
        .set(
          `email_verification:${email}`,
          JSON.stringify({
            code,
            userId: user.id,
            email: user.email,
          }),
          { EX: 15 * 60 },
        )
        .catch(err => {
          log.error("[Redis Set Failed]:", err);
        });

      set.status = 201;

      // Fire-and-forget email
      sendEmail({
        to: email,
        subject: "Verify your email",
        body: `Your verification code is ${code}. It expires in 15 minutes.`,
      }).catch(err => {
        log.error("[Email Send Failed]:", err);
      });

      return {
        status: "success",
        message:
          "Account created successfully. Please check your email to verify your account.",
        data: {
          user,
          requiresEmailVerification: true,
        },
      } as ApiResponse<{
        user: typeof user;
        requiresEmailVerification: boolean;
      }>;
    } catch (err) {
      log.error("[Signup Error]:", err);
      set.status = 500;
      return {
        status: "error",
        message: "Something went wrong while creating your account.",
      } as ApiResponse<null>;
    }
  },
  {
    body: t.Object({
      name: t.String({ minLength: 3, maxLength: 32 }),
      email: t.String({ format: "email" }),
      password: t.String({ minLength: 8, maxLength: 64 }),
      username: t.String({ minLength: 3, maxLength: 32 }),
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

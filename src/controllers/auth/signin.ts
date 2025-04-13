import { t } from "elysia";
import { db } from "../../lib/db";
import { createBaseElysia } from "../../base";
import {
  createSession,
  generateSessionToken,
  setSessionTokenCookie,
} from "../../lib/auth";
import crypto from "crypto";

export const signin = createBaseElysia().post(
  "signin",
  async ({ body, set, log, cookie: { session } }) => {
    try {
      const { email, password } = body;
      const existingUser = await db.user.findUnique({
        where: {
          email,
        },
        select: {
          id: true,
          email: true,
          name: true,
          userName: true,
          password: true,
        },
      });

      if (!existingUser || !existingUser.password) {
        log.error("User not found.");
        set.status = "Bad Request";
        return {
          status: "error",
          message: "Invalid email or password",
        } as ApiResponse<null>;
      }

      const matchPassword = await Bun.password.verify(
        password,
        existingUser.password,
      );

      if (!matchPassword) {
        log.error("Password incorrect.");
        set.status = "Bad Request";
        return {
          status: "error",
          message: "Email address or password incorrect",
        } as ApiResponse<null>;
      }

      // Generate and store session token (for API requests)
      const token = generateSessionToken();
      const dbSession = await createSession(token, existingUser.id);
      setSessionTokenCookie(session, token, dbSession.expiresAt);

      // Generate WebSocket token (for real-time connections)
      const wsToken = crypto.randomUUID();

      // Store WebSocket token with 24-hour expiry
      await db.wsToken.create({
        data: {
          token: wsToken,
          userId: existingUser.id,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        },
      });

      const { password: _, ...userWithoutPassword } = existingUser;

      set.status = 200;
      return {
        status: "success",
        message: "User logged in successfully",
        data: {
          user: userWithoutPassword,
          wsToken, // Include WebSocket token in the response
        },
      } as ApiResponse<{ user: typeof userWithoutPassword; wsToken: string }>;
    } catch (error) {
      log.error("Signin error:", error);
      set.status = 500;
      return {
        status: "error",
        message: "An error occurred during sign in",
      } as ApiResponse<null>;
    }
  },
  {
    body: t.Object({
      email: t.String({
        format: "email",
        error: "Invalid email address",
      }),
      password: t.String({
        minLength: 8,
        maxLength: 64,
        error: "Password must be between 8 and 64 characters long.",
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
            userName: t.Optional(t.String()),
          }),
          wsToken: t.Optional(t.String()),
        }),
      ),
    }),
    detail: {
      tags: ["Auth"],
      summary: "Login to user account",
      description: "Login to user account with email and password",
    },
  },
);

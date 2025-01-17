import { t } from "elysia";
import { db } from "../../lib/db";
import { createBaseElysia } from "../../base";
import {
  createSession,
  generateSessionToken,
  setSessionTokenCookie,
} from "../../lib/auth";

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
        log.error("User not found.");
        set.status = "Bad Request";
        return {
          status: "error",
          message: "Email address or password incorrect",
        } as ApiResponse<null>;
      }

      const token = generateSessionToken();
      const dbSesssion = await createSession(token, existingUser.id);
      // TODO: change from session id to token
      setSessionTokenCookie(session, token, dbSesssion.expiresAt);

      const { password: _, ...userWithoutPassword } = existingUser;

      set.status = 200;

      return {
        status: "success",
        message: "User logged in successfully",
        data: {
          user: userWithoutPassword,
        },
      } as ApiResponse<{ user: typeof userWithoutPassword }>;
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
    detail: {
      tags: ["Auth"],
      summary: "Login to user account",
      description: "Login to user account with email and password",
    },
  },
);

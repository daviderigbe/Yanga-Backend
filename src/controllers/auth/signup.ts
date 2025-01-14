import { t } from "elysia";
import { db } from "../../lib/db";
import { createBaseElysia } from "../../base";

export const signup = createBaseElysia().post(
  "signup",
  async ({ body, set, log }) => {
    try {
      const { email, password, name, username } = body;

      const existingUser = await db.user.findUnique({
        where: {
          email,
        },
      });

      if (existingUser) {
        log.error("User already exists");
        set.status = "Conflict";

        return {
          status: "error",
          message: "User with this email already exists",
        } as ApiResponse<null>;
      }

      const passwordHash = await Bun.password.hash(password);

      const newUser = await db.user.create({
        data: {
          email,
          name,
          userName: username,
          password: passwordHash,
        },
      });

      set.status = 201;
      return {
        status: "success",
        message: "User created successfully",
        data: newUser,
      } as ApiResponse<typeof newUser>;
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
          id: t.Number(),
          email: t.String(),
          name: t.String(),
        }),
      ),
    }),
    detail: {
      tags: ["Auth"],
      summary: "Create new user account",
      description: "Register a new user with email, password and name",
    },
  },
);

import { t } from "elysia";
import { createBaseElysia } from "../../base";
import { validateSessionToken } from "../../lib/auth";
import { db } from "../../lib/db";

export const changePassword = createBaseElysia().post(
  ":id/change-password",
  async ({ params, body, set, log, cookie: { session } }) => {
    try {
      if (!session.value) {
        set.status = "Bad Request";
        return {
          status: "error",
          message: "Session not found",
        };
      }

      const { session: dbSession, user } = await validateSessionToken(
        session.value,
      );

      if (!dbSession || !user) {
        set.status = "Unauthorized";
        return {
          status: "error",
          message: "Invalid session",
        };
      }

      if (user.id !== params.id) {
        set.status = "Forbidden";
        return {
          status: "error",
          message: "You can only edit your own profile",
        };
      }

      // Cases like google login
      if (!user.password) {
        set.status = "Bad Request";
        return {
          status: "error",
          message: "No password set for this user",
        };
      }

      const matchPassword = await Bun.password.verify(
        body.oldPassword,
        user.password,
      );

      if (!matchPassword) {
        set.status = "Bad Request";
        return {
          status: "error",
          message: "Current password incorrect",
        } as ApiResponse<null>;
      }

      const passwordHash = await Bun.password.hash(body.newPassword);

      await db.user.update({
        where: { id: user.id },
        data: {
          password: passwordHash,
        },
      });

      await db.session.deleteMany({
        where: {
          userId: user.id,
          id: { not: dbSession.id }, // Keep current session
        },
      });

      set.status = "OK";
      return {
        status: "success",
        message: "Password updated successfully",
      };
    } catch (error) {
      log.error("Password update error:", error);
      set.status = 500;
      return {
        status: "error",
        message: "An error occurred while updating the password",
      };
    }
  },
  {
    body: t.Object({
      oldPassword: t.String(),
      newPassword: t.String({
        minLength: 8,
        maxLength: 64,
        error: "Password must be between 8 and 64 characters long.",
      }),
    }),
    params: t.Object({
      id: t.String(),
    }),
    detail: {
      tags: ["Users"],
      summary: "Change password",
      description: "Edit current logged in user password",
    },
  },
);

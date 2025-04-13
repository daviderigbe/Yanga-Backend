import { t } from "elysia";
import { createBaseElysia } from "../../base";
import { validateSessionToken } from "../../lib/auth";
import { db } from "../../lib/db";

/**
 * Toggle user unavailability status
 */
export const toggleUnavailability = createBaseElysia().put(
  "/:id/toggle-unavailability",
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
          message: "You can only modify your own availability",
        };
      }

      await db.user.update({
        where: { id: user.id },
        data: {
          userUnavailable: body.unavailable,
        },
      });

      set.status = "OK";
      return {
        status: "success",
        message: body.unavailable
          ? "User marked as unavailable"
          : "User marked as available",
      };
    } catch (error) {
      log.error("Toggle unavailability error:", error);
      set.status = 500;
      return {
        status: "error",
        message: "An error occurred while updating availability status",
      };
    }
  },
  {
    body: t.Object({
      unavailable: t.Boolean(),
    }),
    params: t.Object({
      id: t.String(),
    }),
    detail: {
      tags: ["Users"],
      summary: "Toggle user unavailability",
      description: "Mark user as available or unavailable",
    },
  },
);

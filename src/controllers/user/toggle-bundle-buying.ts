import { t } from "elysia";
import { createBaseElysia } from "../../base";
import { validateSessionToken } from "../../lib/auth";
import { db } from "../../lib/db";

/**
 * Enable/disable bundle buying for the current user
 */
export const toggleBundleBuying = createBaseElysia().put(
  "/:id/toggle-bundle-buying",
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
          message: "You can only modify your own settings",
        };
      }

      await db.user.update({
        where: { id: user.id },
        data: {
          enableBundleBuying: body.enableBundleBuying,
        },
      });

      set.status = "OK";
      return {
        status: "success",
        message: body.enableBundleBuying
          ? "Bundle buying enabled successfully"
          : "Bundle buying disabled successfully",
      };
    } catch (error) {
      log.error("Toggle bundle buying error:", error);
      set.status = 500;
      return {
        status: "error",
        message: "An error occurred while updating bundle buying settings",
      };
    }
  },
  {
    body: t.Object({
      enableBundleBuying: t.Boolean(),
    }),
    params: t.Object({
      id: t.String(),
    }),
    detail: {
      tags: ["Users"],
      summary: "Toggle bundle buying",
      description: "Enable or disable bundle buying for the current user",
    },
  },
);

import { t } from "elysia";
import { createBaseElysia } from "../../base";
import { validateSessionToken } from "../../lib/auth";
import { db } from "../../lib/db";

export const deactivateAccount = createBaseElysia().put(
  "/:id/deactivate",
  async ({ params, set, log, cookie: { session } }) => {
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
          message: "You can only deactivate your own account",
        };
      }

      // Start a transaction to ensure all operations succeed or fail together
      await db.$transaction(async (tx) => {
        // Soft delete the user account by setting isDeactivated flag
        await tx.user.update({
          where: { id: user.id },
          data: {
            isDeactivated: true,
            deactivatedAt: new Date(),
          },
        });

        // Make all products unavailable without changing their status
        await tx.product.updateMany({
          where: { sellerId: user.id },
          data: {
            isAvailable: false,
          },
        });

        // Delete all sessions to log the user out from all devices
        await tx.session.deleteMany({
          where: {
            userId: user.id,
          },
        });
      });

      // Clear the current session cookie
      session.remove();

      set.status = "OK";
      return {
        status: "success",
        message: "Account successfully deactivated. You have been logged out.",
      };
    } catch (error) {
      log.error("Account deactivation error:", error);
      set.status = 500;
      return {
        status: "error",
        message: "An error occurred while deactivating the account",
      };
    }
  },
  {
    params: t.Object({
      id: t.String(),
    }),
    detail: {
      tags: ["Users"],
      summary: "Deactivate account",
      description:
        "Soft delete a user account and log them out of all sessions",
    },
  },
);

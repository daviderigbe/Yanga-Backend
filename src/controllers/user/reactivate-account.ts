import { t } from "elysia";
import { createBaseElysia } from "../../base";
import { validateSessionToken } from "../../lib/auth";
import { db } from "../../lib/db";

export const reactivateAccount = createBaseElysia().put(
  "/:id/reactivate",
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
          message: "You can only reactivate your own account",
        };
      }

      if (!user.isDeactivated) {
        set.status = "Bad Request";
        return {
          status: "error",
          message: "Account is not deactivated",
        };
      }

      // Use a transaction to ensure all operations succeed or fail together
      await db.$transaction(async (tx) => {
        // Reactivate the account
        await tx.user.update({
          where: { id: user.id },
          data: {
            isDeactivated: false,
            deactivatedAt: null,
          },
        });

        // Restore the availability state of products
        // Note: This only restores products that weren't explicitly deleted by the user
        await tx.product.updateMany({
          where: {
            sellerId: user.id,
            status: { not: "DELETED" }, // Don't reactivate products that were intentionally deleted
          },
          data: {
            isAvailable: true,
          },
        });
      });

      set.status = "OK";
      return {
        status: "success",
        message: "Account successfully reactivated",
      };
    } catch (error) {
      log.error("Account reactivation error:", error);
      set.status = 500;
      return {
        status: "error",
        message: "An error occurred while reactivating the account",
      };
    }
  },
  {
    params: t.Object({
      id: t.String(),
    }),
    detail: {
      tags: ["Users"],
      summary: "Reactivate account",
      description: "Reactivate a previously deactivated user account",
    },
  },
);

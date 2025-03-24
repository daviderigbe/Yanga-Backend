import { t } from "elysia";
import { createBaseElysia } from "../../base";
import { validateSessionToken } from "../../lib/auth";
import { db } from "../../lib/db";

export const getUnreadCount = createBaseElysia().get(
  "/messages/unread/count",
  async ({ set, log, cookie: { session } }) => {
    try {
      if (!session.value) {
        set.status = "Bad Request";
        return { status: "error", message: "Session not found" };
      }

      const { session: dbSession, user } = await validateSessionToken(
        session.value,
      );

      if (!dbSession || !user) {
        set.status = "Unauthorized";
        return { status: "error", message: "Invalid session" };
      }

      // Count all unread messages for the current user
      const count = await db.message.count({
        where: {
          receiverId: user.id,
          isRead: false,
        },
      });

      return {
        status: "success",
        data: { count },
      };
    } catch (error) {
      log.error("get unread count error:", error);
      set.status = 500;
      return {
        status: "error",
        message: "An error occurred while getting unread count",
      };
    }
  },
  {
    detail: {
      tags: ["Messages"],
      summary: "Get unread count",
      description: "Get the count of all unread messages for the current user",
    },
  },
);

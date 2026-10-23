import { createBaseElysia } from "../../base";
import { validateSessionToken } from "../../lib/auth";
import { db } from "../../lib/db";

export const getUnreadNotificationCount = createBaseElysia().get(
  "/notifications/unread/count",
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

      const count = await db.notification.count({
        where: { userId: user.id, isRead: false },
      });

      return {
        status: "success",
        data: { count },
      };
    } catch (error) {
      log.error("get unread notification count error:", error);
      set.status = 500;
      return {
        status: "error",
        message: "An error occurred while getting unread notification count",
      };
    }
  },
  {
    detail: {
      tags: ["Notifications"],
      summary: "Get unread notification count",
      description: "Get the count of unread notifications for the current user",
    },
  },
);

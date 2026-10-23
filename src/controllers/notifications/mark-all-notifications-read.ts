import { createBaseElysia } from "../../base";
import { validateSessionToken } from "../../lib/auth";
import { db } from "../../lib/db";

export const markAllNotificationsRead = createBaseElysia().put(
  "/notifications/read-all",
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

      const result = await db.notification.updateMany({
        where: { userId: user.id, isRead: false },
        data: { isRead: true },
      });

      return {
        status: "success",
        message: "All notifications marked as read",
        data: { count: result.count },
      };
    } catch (error) {
      log.error("mark all notifications read error:", error);
      set.status = 500;
      return {
        status: "error",
        message: "An error occurred while marking notifications as read",
      };
    }
  },
  {
    detail: {
      tags: ["Notifications"],
      summary: "Mark all notifications as read",
      description: "Mark every unread notification for the current user as read",
    },
  },
);

import { t } from "elysia";
import { createBaseElysia } from "../../base";
import { validateSessionToken } from "../../lib/auth";
import { db } from "../../lib/db";

export const markNotificationRead = createBaseElysia().put(
  "/notifications/:id/read",
  async ({ set, log, cookie: { session }, params }) => {
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

      const notification = await db.notification.findUnique({
        where: { id: params.id },
      });

      if (!notification || notification.userId !== user.id) {
        set.status = "Not Found";
        return { status: "error", message: "Notification not found" };
      }

      const updated = await db.notification.update({
        where: { id: params.id },
        data: { isRead: true },
      });

      return {
        status: "success",
        message: "Notification marked as read",
        data: updated,
      };
    } catch (error) {
      log.error("mark notification read error:", error);
      set.status = 500;
      return {
        status: "error",
        message: "An error occurred while marking the notification as read",
      };
    }
  },
  {
    params: t.Object({
      id: t.String(),
    }),
    detail: {
      tags: ["Notifications"],
      summary: "Mark notification as read",
      description: "Mark a single notification as read",
    },
  },
);

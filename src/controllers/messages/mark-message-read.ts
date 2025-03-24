import { t } from "elysia";
import { createBaseElysia } from "../../base";
import { validateSessionToken } from "../../lib/auth";
import { db } from "../../lib/db";

export const markMessagesAsRead = createBaseElysia().put(
  "/conversations/:userId/read",
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

      // Mark all messages from the specified user as read
      const result = await db.message.updateMany({
        where: {
          senderId: params.userId,
          receiverId: user.id,
          isRead: false,
        },
        data: {
          isRead: true,
        },
      });

      return {
        status: "success",
        message: "Messages marked as read",
        data: { count: result.count },
      };
    } catch (error) {
      log.error("mark messages as read error:", error);
      set.status = 500;
      return {
        status: "error",
        message: "An error occurred while marking messages as read",
      };
    }
  },
  {
    params: t.Object({
      userId: t.String(),
    }),
    detail: {
      tags: ["Messages"],
      summary: "Mark messages as read",
      description: "Mark all messages from a specific user as read",
    },
  },
);

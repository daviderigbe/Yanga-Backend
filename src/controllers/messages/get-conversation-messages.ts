import { t } from "elysia";
import { createBaseElysia } from "../../base";
import { validateSessionToken } from "../../lib/auth";
import { db } from "../../lib/db";

export const getConversationMessages = createBaseElysia().get(
  "/conversations/:userId",
  async ({ set, log, cookie: { session }, params, query }) => {
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

      // Verify the other user exists
      const otherUser = await db.user.findUnique({
        where: { id: params.userId },
        select: { id: true, name: true, userName: true, imageUrl: true },
      });

      if (!otherUser) {
        set.status = "Not Found";
        return { status: "error", message: "User not found" };
      }

      // Get messages between the current user and the specified user
      const messages = await db.message.findMany({
        where: {
          OR: [
            { senderId: user.id, receiverId: params.userId },
            { senderId: params.userId, receiverId: user.id },
          ],
        },
        orderBy: {
          createdAt: "asc",
        },
        skip: query.skip ? parseInt(query.skip) : 0,
        take: query.limit ? parseInt(query.limit) : 50,
      });

      // Mark all unread messages as read
      if (query.markAsRead === "true") {
        await db.message.updateMany({
          where: {
            senderId: params.userId,
            receiverId: user.id,
            isRead: false,
          },
          data: {
            isRead: true,
          },
        });
      }

      return {
        status: "success",
        data: {
          messages,
          user: otherUser,
        },
      };
    } catch (error) {
      log.error("get conversation messages error:", error);
      set.status = 500;
      return {
        status: "error",
        message: "An error occurred while fetching messages",
      };
    }
  },
  {
    params: t.Object({
      userId: t.String(),
    }),
    query: t.Object({
      limit: t.Optional(t.String()),
      skip: t.Optional(t.String()),
      markAsRead: t.Optional(t.String()),
    }),
    detail: {
      tags: ["Messages"],
      summary: "Get conversation messages",
      description:
        "Retrieve messages between the current user and a specific user",
    },
  },
);

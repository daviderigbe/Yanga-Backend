import { t } from "elysia";
import { createBaseElysia } from "../../base";
import { validateSessionToken } from "../../lib/auth";
import { db } from "../../lib/db";

export const getConversationMessages = createBaseElysia().get(
  "/conversations/:userId",
  async ({ set, log, cookie: { session }, params, query }) => {
    try {
      if (!session.value) {
        set.status = 400;
        return { status: "error", message: "Session not found" };
      }
      const { session: dbSession, user } = await validateSessionToken(
        session.value,
      );
      if (!dbSession || !user) {
        set.status = 401;
        return { status: "error", message: "Invalid session" };
      }
      // Verify the other user exists
      const otherUser = await db.user.findUnique({
        where: { id: params.userId },
        select: { id: true, name: true, userName: true, imageUrl: true },
      });
      if (!otherUser) {
        set.status = 404;
        return { status: "error", message: "User not found" };
      }
      // Find or create conversation
      const conversation = await db.conversation.upsert({
        where: {
          memberOneId_memberTwoId: {
            memberOneId: user.id < params.userId ? user.id : params.userId,
            memberTwoId: user.id < params.userId ? params.userId : user.id,
          },
        },
        update: {},
        create: {
          memberOneId: user.id < params.userId ? user.id : params.userId,
          memberTwoId: user.id < params.userId ? params.userId : user.id,
        },
        select: { id: true },
      });

      // Parse query parameters with default values and type conversion
      const limit = query.limit ? parseInt(query.limit, 10) : 50;
      const skip = query.skip ? parseInt(query.skip, 10) : 0;

      // Get messages for this conversation
      const messages = await db.message.findMany({
        where: {
          conversationId: conversation.id,
        },
        orderBy: {
          createdAt: "asc",
        },
        skip,
        take: limit,
      });

      // Mark all unread messages as read if requested
      if (query.markAsRead === "true") {
        await db.message.updateMany({
          where: {
            conversationId: conversation.id,
            senderId: params.userId,
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
          conversationId: conversation.id,
        },
      };
    } catch (error) {
      log.error("get conversation messages error:", error);
      set.status = 500;
      return {
        status: "error",
        message: "An error occurred while fetching messages",
        ...(process.env.NODE_ENV === "development" && {
          details: error instanceof Error ? error.message : "Unknown error",
        }),
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

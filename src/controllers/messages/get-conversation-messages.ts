import { t } from "elysia";
import { createBaseElysia } from "../../base";
import { validateSessionToken } from "../../lib/auth";
import { db } from "../../lib/db";

export const getConversationMessages = createBaseElysia().get(
  "/conversations/:userId",
  async ({ set, log, cookie: { session }, params, query }) => {
    try {
      // 1. Session validation
      if (!session.value) {
        set.status = 401;
        return { status: "error", message: "Authentication required" };
      }

      const { session: dbSession, user } = await validateSessionToken(
        session.value,
      );

      if (!dbSession || !user) {
        set.status = 401;
        return { status: "error", message: "Invalid session" };
      }

      // 2. Target user verification
      const otherUser = await db.user.findUnique({
        where: {
          id: params.userId,
          isDeactivated: false, // Only include active users
        },
        select: {
          id: true,
          name: true,
          userName: true,
          imageUrl: true,
        },
      });

      if (!otherUser) {
        set.status = 404;
        return { status: "error", message: "User not found or is deactivated" };
      }

      // 3. Prevent self-conversation
      if (user.id === params.userId) {
        set.status = 400;
        return {
          status: "error",
          message: "Cannot create conversation with yourself",
        };
      }

      // 4. Consistent member ordering logic for conversation lookup
      const [memberOneId, memberTwoId] =
        user.id < params.userId
          ? [user.id, params.userId]
          : [params.userId, user.id];

      // 5. Parse and validate query parameters
      const limit = Math.min(
        query.limit ? parseInt(query.limit, 10) : 50,
        100, // Maximum limit to prevent excessive queries
      );

      const skip = Math.max(
        query.skip ? parseInt(query.skip, 10) : 0,
        0, // Ensure skip is never negative
      );

      const markAsRead = query.markAsRead === "true";

      // 6. Use a transaction for related operations
      const result = await db.$transaction(async (tx) => {
        // Find or create conversation
        const conversation = await tx.conversation.upsert({
          where: {
            memberOneId_memberTwoId: {
              memberOneId,
              memberTwoId,
            },
          },
          update: {
            updatedAt: new Date(), // Update conversation timestamp when viewed
          },
          create: {
            memberOneId,
            memberTwoId,
          },
          select: { id: true },
        });

        // Get messages for this conversation
        const messages = await tx.message.findMany({
          where: {
            conversationId: conversation.id,
          },
          orderBy: {
            createdAt: "desc", // Get newest messages first
          },
          skip,
          take: limit,
        });

        // Mark unread messages as read if requested
        if (markAsRead) {
          await tx.message.updateMany({
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

        // Count unread messages (optional enhancement)
        const unreadCount = markAsRead
          ? 0
          : await tx.message.count({
              where: {
                conversationId: conversation.id,
                senderId: params.userId,
                isRead: false,
              },
            });

        return {
          messages: messages.reverse(), // Reverse to get ascending order after desc query
          user: otherUser,
          conversationId: conversation.id,
          unreadCount,
        };
      });

      return {
        status: "success",
        data: result,
      };
    } catch (error) {
      log.error("get conversation messages error:", error);

      // Handle specific error types
      if (error instanceof SyntaxError) {
        set.status = 400;
        return {
          status: "error",
          message: "Invalid parameters",
        };
      }

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
        "Retrieve messages between the current user and a specific user, creating a conversation if it doesn't exist",
    },
  },
);

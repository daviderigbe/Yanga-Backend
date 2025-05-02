import { t } from "elysia";
import { createBaseElysia } from "../../base";
import { validateSessionToken } from "../../lib/auth";
import { db } from "../../lib/db";
import { Prisma } from "@prisma/client";

// Define response types for better type safety

export const getConversations = createBaseElysia().get(
  "/conversations",
  async ({ set, log, cookie: { session }, query }) => {
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

      // 2. Parse and validate query parameters
      const limit = Math.min(
        query.limit ? parseInt(query.limit, 10) : 20,
        50, // Maximum limit to prevent excessive queries
      );

      const skip = Math.max(
        query.skip ? parseInt(query.skip, 10) : 0,
        0, // Ensure skip is never negative
      );

      // 3. Get total count for pagination
      const totalCount = await db.conversation.count({
        where: {
          OR: [{ memberOneId: user.id }, { memberTwoId: user.id }],
        },
      });

      // 4. Get conversations with optimized query
      const conversations = await db.conversation.findMany({
        where: {
          OR: [{ memberOneId: user.id }, { memberTwoId: user.id }],
          // Optional: Filter out conversations with no messages
          messages: {
            some: {}, // At least one message exists
          },
        },
        include: {
          memberOne: {
            select: {
              id: true,
              name: true,
              userName: true,
              imageUrl: true,
              // Optional: Include online status indicator
              userUnavailable: true,
            },
          },
          memberTwo: {
            select: {
              id: true,
              name: true,
              userName: true,
              imageUrl: true,
              // Optional: Include online status indicator
              userUnavailable: true,
            },
          },
          messages: {
            take: 1,
            orderBy: { createdAt: "desc" },
            select: {
              content: true,
              createdAt: true,
              isRead: true,
              senderId: true,
              fileUrl: true, // Include if there's an attachment
            },
          },
          // Add this to optimize by fetching unread counts in the same query
          _count: {
            select: {
              messages: {
                where: {
                  isRead: false,
                  NOT: {
                    senderId: user.id, // Don't count messages sent by current user
                  },
                },
              },
            },
          },
        },
        orderBy: {
          updatedAt: "desc", // Most recent conversations first
        },
        skip,
        take: limit,
      });

      // 5. Transform the data for the frontend
      const conversationsData = conversations.map((conv) => {
        // Determine other member
        const otherMember =
          conv.memberOneId === user.id ? conv.memberTwo : conv.memberOne;

        const lastMessage = conv.messages[0];

        return {
          id: conv.id,
          otherMemberId: otherMember.id,
          name: otherMember.name,
          userName: otherMember.userName,
          imageUrl: otherMember.imageUrl,
          lastMessage: lastMessage?.content,
          hasAttachment: Boolean(lastMessage?.fileUrl),
          lastMessageTime: lastMessage?.createdAt,
          // Use the optimized count from the query
          unreadCount: conv._count.messages,
          // Optional: Include online status
          isOnline: otherMember.userUnavailable === false,
          // You could add these fields if needed
          // isLastMessageFromYou: lastMessage?.senderId === user.id,
          // lastMessageRead: lastMessage?.isRead
        };
      });

      // 6. Return with pagination info
      return {
        status: "success",
        data: conversationsData,
        pagination: {
          total: totalCount,
          hasMore: skip + limit < totalCount,
        },
      };
    } catch (error) {
      log.error("Conversations fetch error:", error);

      // Detailed error logging
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        log.error("Prisma Error Code:", error.code);
        log.error("Prisma Error Meta:", error.meta);
      } else if (error instanceof Prisma.PrismaClientValidationError) {
        log.error("Prisma Validation Error");
      }

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
        message: "An error occurred while fetching conversations",
        ...(process.env.NODE_ENV === "development" && {
          details: error instanceof Error ? error.message : "Unknown error",
        }),
      };
    }
  },
  {
    query: t.Object({
      limit: t.Optional(t.String()),
      skip: t.Optional(t.String()),
    }),
    detail: {
      tags: ["Messages"],
      summary: "Get conversations",
      description:
        "Retrieve all conversations for the current user, sorted by most recent activity",
    },
  },
);

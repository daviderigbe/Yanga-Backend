import { t } from "elysia";
import { createBaseElysia } from "../../base";
import { validateSessionToken } from "../../lib/auth";
import { db } from "../../lib/db";
import { Prisma } from "@prisma/client";

export const getConversations = createBaseElysia().get(
  "/conversations",
  async ({ set, log, cookie: { session }, query }) => {
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

      const conversations = await db.conversation.findMany({
        where: {
          OR: [{ memberOneId: user.id }, { memberTwoId: user.id }],
        },
        include: {
          memberOne: {
            select: {
              id: true,
              name: true,
              userName: true,
              imageUrl: true,
            },
          },
          memberTwo: {
            select: {
              id: true,
              name: true,
              userName: true,
              imageUrl: true,
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
            },
          },
        },
        orderBy: {
          updatedAt: "desc",
        },
        take: query.limit ? parseInt(query.limit) : undefined,
      });

      // Get all unread messages count in a separate query for each conversation
      const conversationsWithUnreadCount = await Promise.all(
        conversations.map(async (conv) => {
          // Get the other member's ID
          const otherMemberId =
            conv.memberOneId === user.id ? conv.memberTwoId : conv.memberOneId;

          // Count unread messages from the other person
          const unreadCount = await db.message.count({
            where: {
              conversationId: conv.id,
              senderId: otherMemberId, // From the other user
              isRead: false, // Not read yet
            },
          });

          // Determine the other member
          const otherMember =
            conv.memberOneId === user.id ? conv.memberTwo : conv.memberOne;

          const lastMessage = conv.messages[0];

          return {
            id: conv.id, // Keep the conversation ID
            otherMemberId: otherMember.id,
            name: otherMember.name,
            userName: otherMember.userName,
            imageUrl: otherMember.imageUrl,
            last_message: lastMessage?.content,
            last_message_time: lastMessage?.createdAt,
            unread_count: unreadCount,
          };
        }),
      );

      return {
        status: "success",
        data: conversationsWithUnreadCount,
      };
    } catch (error) {
      log.error("Conversations fetch error:", error);
      // More detailed error logging
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        log.error("Prisma Error Code:", error.code);
        log.error("Prisma Error Meta:", error.meta);
      }

      set.status = 500;
      return {
        status: "error",
        message: "An error occurred while fetching conversations",
        // Include error details in development
        ...(process.env.NODE_ENV === "development" && {
          details: error instanceof Error ? error.message : "Unknown error",
        }),
      };
    }
  },
  {
    query: t.Object({
      limit: t.Optional(t.String()),
    }),
    detail: {
      tags: ["Messages"],
      summary: "Get conversations",
      description:
        "Retrieve all conversations for the current user, sorted by most recent",
    },
  },
);

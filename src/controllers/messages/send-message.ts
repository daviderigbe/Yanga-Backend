import { t } from "elysia";
import { createBaseElysia } from "../../base";
import { validateSessionToken } from "../../lib/auth";
import { db } from "../../lib/db";
import { broadcastMessageEvent } from "../../ws/broadcast";

export const sendMessage = createBaseElysia().post(
  "/messages",
  async ({ body, set, log, cookie: { session } }) => {
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

      // Verify the receiver exists
      const receiver = await db.user.findUnique({
        where: { id: body.receiverId },
      });
      if (!receiver) {
        set.status = "Not Found";
        return { status: "error", message: "Receiver not found" };
      }

      // Find or create a conversation between the two users
      let conversation = await db.conversation.findFirst({
        where: {
          OR: [
            {
              memberOneId: user.id,
              memberTwoId: body.receiverId,
            },
            {
              memberOneId: body.receiverId,
              memberTwoId: user.id,
            },
          ],
        },
      });

      // If no conversation exists, create a new one
      if (!conversation) {
        conversation = await db.conversation.create({
          data: {
            memberOneId: user.id,
            memberTwoId: body.receiverId,
          },
        });
      }

      // Create the message
      const message = await db.message.create({
        data: {
          senderId: user.id,
          conversationId: conversation.id,
          content: body.content,
          // Optional product reference
          ...(body.productId ? { productId: body.productId } : {}),
          isRead: false,
        },
        include: {
          sender: true,
          conversation: true,
          product: body.productId ? true : false,
        },
      });

      // Create notification for the receiver
      const notification = await db.notification.create({
        data: {
          userId: body.receiverId,
          type: "NEW_MESSAGE",
          content: `You have a new message from ${user.name || user.userName || "a user"}.`,
          isRead: false,
        },
      });

      broadcastMessageEvent({
        type: "NEW_MESSAGE",
        from: user.id,
        to: body.receiverId,
        conversationId: conversation.id,
        data: {
          message,
          notification,
        },
      });

      return {
        status: "success",
        message: "Message sent successfully",
        data: message,
      };
    } catch (error) {
      log.error("send message error:", error);
      set.status = 500;
      return {
        status: "error",
        message: "An error occurred while sending the message",
      };
    }
  },
  {
    body: t.Object({
      receiverId: t.String(),
      content: t.String(),
      productId: t.Optional(t.String()),
    }),
    detail: {
      tags: ["Messages"],
      summary: "Send message",
      description: "Send a message to another user within a conversation",
    },
  },
);

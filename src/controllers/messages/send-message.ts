import { t } from "elysia";
import { createBaseElysia } from "../../base";
import { validateSessionToken } from "../../lib/auth";
import { db } from "../../lib/db";

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

      // Create the message
      const message = await db.message.create({
        data: {
          senderId: user.id,
          receiverId: body.receiverId,
          productId: body.productId,
          content: body.content,
          isRead: false,
        },
      });

      // Create notification for the receiver
      await db.notification.create({
        data: {
          userId: body.receiverId,
          type: "NEW_MESSAGE",
          content: `You have a new message from ${user.name || user.userName || "a user"}.`,
          isRead: false,
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
      description: "Send a message to another user",
    },
  },
);

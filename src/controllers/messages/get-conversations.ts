import { t } from "elysia";
import { createBaseElysia } from "../../base";
import { validateSessionToken } from "../../lib/auth";
import { db } from "../../lib/db";

// Get all conversations for the current user (for sidebar)
export const getConversations = createBaseElysia().get(
  "/conversations",
  async ({ set, log, cookie: { session }, query }) => {
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

      // Find all unique users the current user has exchanged messages with
      const conversations = await db.$queryRaw`
        WITH conversation_partners AS (
          SELECT
            CASE 
              WHEN "senderId" = ${user.id} THEN "receiverId"
              ELSE "senderId"
            END AS partner_id,
            MAX("createdAt") as last_message_time
          FROM "Message"
          WHERE "senderId" = ${user.id} OR "receiverId" = ${user.id}
          GROUP BY partner_id
          ORDER BY last_message_time DESC
          ${query.limit ? `LIMIT ${parseInt(query.limit)}` : ""}
        )

        SELECT 
          u.id, 
          u.name, 
          u.userName, 
          u.imageUrl,
          (
            SELECT content 
            FROM "Message" m
            WHERE (m."senderId" = ${user.id} AND m."receiverId" = u.id) 
              OR (m."receiverId" = ${user.id} AND m."senderId" = u.id)
            ORDER BY m."createdAt" DESC
            LIMIT 1
          ) as last_message,
          (
            SELECT "createdAt" 
            FROM "Message" m
            WHERE (m."senderId" = ${user.id} AND m."receiverId" = u.id) 
              OR (m."receiverId" = ${user.id} AND m."senderId" = u.id)
            ORDER BY m."createdAt" DESC
            LIMIT 1
          ) as last_message_time,
          (
            SELECT COUNT(*) 
            FROM "Message" m
            WHERE m."senderId" = u.id 
              AND m."receiverId" = ${user.id}
              AND m."isRead" = false
          ) as unread_count
        FROM "User" u
        JOIN conversation_partners cp ON u.id = cp.partner_id
        ORDER BY last_message_time DESC
      `;

      return {
        status: "success",
        data: conversations,
      };
    } catch (error) {
      log.error("get conversations error:", error);
      set.status = 500;
      return {
        status: "error",
        message: "An error occurred while fetching conversations",
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

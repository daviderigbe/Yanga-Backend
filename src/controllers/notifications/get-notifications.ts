import { t } from "elysia";
import { createBaseElysia } from "../../base";
import { validateSessionToken } from "../../lib/auth";
import { db } from "../../lib/db";

export const getNotifications = createBaseElysia().get(
  "/notifications",
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

      const limit = Math.min(query.limit ? parseInt(query.limit, 10) : 20, 50);
      const skip = Math.max(query.skip ? parseInt(query.skip, 10) : 0, 0);

      const [notifications, totalCount] = await Promise.all([
        db.notification.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
        db.notification.count({ where: { userId: user.id } }),
      ]);

      return {
        status: "success",
        data: { items: notifications },
        pagination: {
          total: totalCount,
          hasMore: skip + limit < totalCount,
        },
      };
    } catch (error) {
      log.error("get notifications error:", error);
      set.status = 500;
      return {
        status: "error",
        message: "An error occurred while fetching notifications",
      };
    }
  },
  {
    query: t.Object({
      limit: t.Optional(t.String()),
      skip: t.Optional(t.String()),
    }),
    detail: {
      tags: ["Notifications"],
      summary: "Get notifications",
      description: "Retrieve notifications for the current user, most recent first",
    },
  },
);

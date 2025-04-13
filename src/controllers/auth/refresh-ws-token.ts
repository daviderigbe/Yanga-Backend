import { createBaseElysia } from "../../base";
import { validateSessionToken } from "../../lib/auth";
import { db } from "../../lib/db";

export const refreshWsToken = createBaseElysia().get(
  "refresh-ws-token",
  async ({ set, log, cookie: { session } }) => {
    try {
      if (!session.value) {
        set.status = 401;
        return {
          status: "error",
          message: "Not authenticated",
          authenticated: false,
        };
      }

      // Validate the session token
      const { session: dbSession, user } = await validateSessionToken(
        session.value,
      );

      // If session is invalid or expired
      if (!dbSession || !user) {
        set.status = 401;
        return {
          status: "error",
          message: "Invalid or expired session",
          authenticated: false,
        };
      }

      // Generate new WebSocket token
      const wsToken = crypto.randomUUID();

      // Delete any existing tokens for this user (optional, prevents token buildup)
      await db.wsToken.deleteMany({
        where: { userId: user.id },
      });

      // Store WebSocket token with 24-hour expiry
      await db.wsToken.create({
        data: {
          token: wsToken,
          userId: user.id,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        },
      });

      return {
        status: "success",
        message: "WebSocket token refreshed",
        data: {
          wsToken,
        },
      } as ApiResponse<{ wsToken: string }>;
    } catch (error) {
      log.error("WS Token refresh error:", error);
      set.status = 500;
      return {
        status: "error",
        message: "An error occurred while refreshing WebSocket token",
      } as ApiResponse<null>;
    }
  },
  {
    detail: {
      tags: ["Auth"],
      summary: "Refresh WebSocket token",
      description: "Get a fresh WebSocket token using an existing session",
    },
  },
);

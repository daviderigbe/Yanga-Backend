import { createBaseElysia } from "../../base";
import { validateSessionToken } from "../../lib/auth";
import { db } from "../../lib/db";

export const wsToken = createBaseElysia().get(
  "",
  async ({ set, log, cookie: { session } }) => {
    try {
      // Validate session
      if (!session.value) {
        set.status = "Bad Request";
        return {
          status: "error",
          message: "Session not found",
        };
      }

      const { session: dbSession, user } = await validateSessionToken(
        session.value,
      );
      if (!dbSession || !user) {
        set.status = "Unauthorized";
        return {
          status: "error",
          message: "Invalid session",
        };
      }

      // Current time
      const now = new Date();

      // Check for valid existing tokens
      const validToken = await db.wsToken.findFirst({
        where: {
          userId: user.id,
          expiresAt: {
            gt: now,
          },
        },
      });

      // If we have a valid token, extend its expiry time
      if (validToken) {
        // Set new expiry to 7 days from now
        const newExpiryDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

        const updatedToken = await db.wsToken.update({
          where: {
            id: validToken.id,
          },
          data: {
            expiresAt: newExpiryDate,
          },
        });

        return {
          status: "success",
          data: {
            token: updatedToken.token,
            expiresAt: updatedToken.expiresAt,
          },
        };
      }

      // If no valid token, clean up expired ones and create a new one
      await db.wsToken.deleteMany({
        where: {
          userId: user.id,
        },
      });

      // Create a new token
      const expiryDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 24 hours from now
      const token = crypto.randomUUID(); // Generate a random token

      const newToken = await db.wsToken.create({
        data: {
          token,
          userId: user.id,
          expiresAt: expiryDate,
        },
      });

      return {
        status: "success",
        data: {
          token: newToken.token,
          expiresAt: newToken.expiresAt,
        },
      };
    } catch (error) {
      log.error("WS token error:", error);
      set.status = 500;
      return {
        status: "error",
        message: "An error occurred while generating WebSocket token",
      };
    }
  },
  {
    detail: {
      tags: ["WebSocket"],
      summary: "Get WebSocket Token",
      description:
        "Gets a valid WebSocket token for the current user. Returns an existing token if it hasn't expired or creates a new one if needed.",
    },
  },
);

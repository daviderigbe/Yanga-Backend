import { createBaseElysia } from "../../base";
import { validateSessionToken } from "../../lib/auth";

export const checkAuth = createBaseElysia().get(
  "me",
  async ({ set, log, cookie: { session } }) => {
    try {
      // Check if session cookie exists
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

      // User is authenticated, return user data (excluding sensitive info)
      const { password, ...safeUserData } = user;

      return {
        status: "success",
        message: "User is authenticated",
        authenticated: true,
        data: {
          user: safeUserData,
        },
      };
    } catch (error) {
      log.error("Check auth error:", error);
      set.status = 500;
      return {
        status: "error",
        message: "An error occurred while checking authentication status",
        authenticated: false,
      };
    }
  },
  {
    detail: {
      tags: ["Auth"],
      summary: "Check authentication status",
      description:
        "Verify if the current user is authenticated and return user data if they are",
    },
  },
);

import { t } from "elysia";
import { createBaseElysia } from "../../base";
import { deleteSessionTokenCookie, invalidateSession } from "../../lib/auth";

const logout = createBaseElysia().post(
  "signout",
  async ({ set, log, cookie: { session } }) => {
    if (!session.value) {
      set.status = "Bad Request";
      return {
        status: "error",
        message: "Session not found",
      };
    }

    try {
      await invalidateSession(session.value);
      deleteSessionTokenCookie(session);

      set.status = 200;

      return {
        status: "success",
        message: "Logged out successfully",
      };
    } catch (error) {
      log.error("Error logging out", error);
      set.status = 500;
      return {
        status: "error",
        message: "An unexpected error occurred",
      };
    }
  },
  {
    type: "json",
    body: t.Object({}),
    detail: {
      tags: ["Auth"],
      summary: "Logout",
      description: "Logout the user",
    },
  },
);

export { logout };

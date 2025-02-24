import { t } from "elysia";
import { createBaseElysia } from "../../base";
import { validateSessionToken } from "../../lib/auth";
import { db } from "../../lib/db";

export const unfollowUser = createBaseElysia().delete(
  ":id/follow",
  async ({ set, log, cookie: { session }, params }) => {
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

      // Check if target user exists
      const targetUser = await db.user.findUnique({
        where: { id: params.id },
      });

      if (!targetUser) {
        set.status = "Not Found";
        return { status: "error", message: "User not found" };
      }

      // Prevent self-unfollowing
      if (user.id === params.id) {
        set.status = "Bad Request";
        return { status: "error", message: "You cannot unfollow yourself" };
      }

      // Check if follow relationship exists
      const existingFollow = await db.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: user.id,
            followingId: params.id,
          },
        },
      });

      if (!existingFollow) {
        set.status = "Bad Request";
        return { status: "error", message: "You are not following this user" };
      }

      // Delete follow relationship
      await db.follow.delete({
        where: {
          followerId_followingId: {
            followerId: user.id,
            followingId: params.id,
          },
        },
      });

      return {
        status: "success",
        message: "Successfully unfollowed user",
      };
    } catch (error) {
      log.error("unfollow user error:", error);
      set.status = 500;
      return {
        status: "error",
        message: "An error occurred while unfollowing the user",
      };
    }
  },
  {
    params: t.Object({
      id: t.String(),
    }),
    detail: {
      tags: ["Users"],
      summary: "Unfollow a user",
      description: "Remove a follow relationship with another user",
    },
  },
);

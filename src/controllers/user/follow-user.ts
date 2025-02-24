import { t } from "elysia";
import { createBaseElysia } from "../../base";
import { validateSessionToken } from "../../lib/auth";
import { db } from "../../lib/db";

export const followUser = createBaseElysia().post(
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

      // Prevent self-following
      if (user.id === params.id) {
        set.status = "Bad Request";
        return { status: "error", message: "You cannot follow yourself" };
      }

      // Check if already following
      const existingFollow = await db.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: user.id,
            followingId: params.id,
          },
        },
      });

      if (existingFollow) {
        set.status = "Bad Request";
        return {
          status: "error",
          message: "You are already following this user",
        };
      }

      // Create follow relationship
      const follow = await db.follow.create({
        data: {
          followerId: user.id,
          followingId: params.id,
        },
      });

      //TODO: // Create notification for followed user
      // await db.notification.create({
      //   data: {
      //     userId: params.id,
      //     type: "NEW_FOLLOWER",
      //     content: `${user.name || "Someone"} started following you`
      //   }
      // });

      return {
        status: "success",
        message: "Successfully followed user",
        data: follow,
      };
    } catch (error) {
      log.error("follow user error:", error);
      set.status = 500;
      return {
        status: "error",
        message: "An error occurred while following the user",
      };
    }
  },
  {
    params: t.Object({
      id: t.String(),
    }),
    detail: {
      tags: ["Users"],
      summary: "Follow a user",
      description: "Create a follow relationship with another user",
    },
  },
);

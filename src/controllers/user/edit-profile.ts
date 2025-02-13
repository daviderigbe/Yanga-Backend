import { t } from "elysia";
import { createBaseElysia } from "../../base";
import { validateSessionToken } from "../../lib/auth";
import { db } from "../../lib/db";

export const editProfile = createBaseElysia().post(
  ":id/edit-profile",
  async ({ body, set, log, cookie: { session }, params }) => {
    try {
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

      if (user.id !== params.id) {
        set.status = "Forbidden";
        return {
          status: "error",
          message: "You can only edit your own profile",
        };
      }

      if (body.username !== user.userName) {
        const existingUser = await db.user.findUnique({
          where: { userName: body.username },
        });

        if (existingUser) {
          set.status = "Bad Request";
          return {
            status: "error",
            message: "Username already taken",
          };
        }
      }

      const updatedUser = await db.user.update({
        where: { id: user.id },
        data: {
          name: body.name,
          userName: body.username,
          bio: body.bio,
          imageUrl: body.image,
        },
        select: {
          id: true,
          name: true,
          userName: true,
          bio: true,
          imageUrl: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return {
        status: "success",
        message: "Profile updated successfully",
        data: updatedUser,
      };
    } catch (error) {
      log.error("Profile update error:", error);
      set.status = 500;
      return {
        status: "error",
        message: "An error occurred while updating the profile",
      };
    }
  },
  {
    body: t.Object({
      name: t.String(),
      username: t.String(),
      bio: t.String(),
      image: t.String(),
    }),
    params: t.Object({
      id: t.String(),
    }),
    detail: {
      tags: ["Users"],
      summary: "Edit user profile",
      description: "Edit current logged in users profile with new information",
    },
  },
);

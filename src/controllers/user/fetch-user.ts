import { t } from "elysia";
import { createBaseElysia } from "../../base";
import { db } from "../../lib/db";
import { validateSessionToken } from "../../lib/auth"; // Make sure this is imported

// Update the response schema to include isFollowing
const UserResponseSchema = t.Object({
  status: t.Enum({ success: "success", error: "error" }),
  message: t.String(),
  data: t.Optional(
    t.Object({
      id: t.String(),
      name: t.Optional(t.Union([t.String(), t.Null()])),
      email: t.String(),
      imageUrl: t.Optional(t.Union([t.String(), t.Null()])),
      bio: t.Optional(t.Union([t.String(), t.Null()])),
      emailVerified: t.Optional(t.Boolean()),
      userName: t.Optional(t.Union([t.String(), t.Null()])),
      enableBundleBuying: t.Boolean(),
      unavailableUntil: t.Optional(t.Union([t.String(), t.Null()])),
      createdAt: t.Union([t.String(), t.Date()]),
      updatedAt: t.Union([t.String(), t.Date()]),
      isFollowing: t.Optional(t.Boolean()), // Add isFollowing field
      stats: t.Object({
        productsCount: t.Number(),
        soldCount: t.Number(),
        followersCount: t.Number(),
        followingCount: t.Number(),
        averageRating: t.Optional(t.Union([t.Number(), t.Null()])),
      }),
    }),
  ),
});

export const fetchUserById = createBaseElysia().get(
  "/:id",
  async ({ set, log, params, cookie: { session } }) => {
    try {
      const { id } = params;

      // Get logged-in user information if available
      let currentUser = null;
      if (session && session.value) {
        try {
          const sessionData = await validateSessionToken(session.value);
          if (sessionData && sessionData.user) {
            currentUser = sessionData.user;
          }
        } catch (error) {
          // Invalid session, but we can still return user data without isFollowing
          log.error("Session validation error:", error);
        }
      }

      const user = await db.user.findUnique({
        where: { id },
        include: {
          _count: {
            select: {
              products: true,
              followers: true,
              following: true,
            },
          },
          reviews: {
            select: {
              rating: true,
            },
          },
          products: {
            where: {
              status: "SOLD",
            },
            select: {
              id: true,
            },
          },
          followers: currentUser
            ? {
                where: {
                  followerId: currentUser.id,
                },
              }
            : undefined,
        },
      });

      if (!user) {
        set.status = 404;
        return {
          status: "error",
          message: "User not found",
        };
      }

      const {
        password,
        googleId,
        appleId,
        _count,
        reviews,
        products,
        followers,
        ...userData
      } = user;

      // Calculate average rating
      const averageRating =
        reviews.length > 0
          ? reviews.reduce((acc, rev) => acc + rev.rating, 0) / reviews.length
          : null;

      // Determine if current user is following this user
      const isFollowing = currentUser ? followers.length > 0 : undefined;

      const transformedUser = {
        ...userData,
        isFollowing,
        stats: {
          productsCount: _count.products,
          soldCount: products.length,
          followersCount: _count.followers,
          followingCount: _count.following,
          averageRating,
        },
      };

      return {
        status: "success",
        message: "User retrieved successfully",
        data: transformedUser,
      };
    } catch (error) {
      log.error(error);
      set.status = 500;
      return {
        status: "error",
        message: "Failed to fetch user",
      };
    }
  },
  {
    params: t.Object({
      id: t.String(),
    }),
    response: UserResponseSchema,
    detail: {
      tags: ["Users"],
      summary: "Fetch user profile",
      description:
        "Fetch basic user information and stats including whether the current user is following them",
    },
  },
);

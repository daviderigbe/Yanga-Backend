import { t } from "elysia";
import { createBaseElysia } from "../../base";
import { db } from "../../lib/db";
import { validateSessionToken } from "../../lib/auth";

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
      isFollowing: t.Optional(t.Boolean()),
      stats: t.Object({
        productsCount: t.Number(),
        soldCount: t.Number(),
        followersCount: t.Number(),
        followingCount: t.Number(),
        averageRating: t.Optional(t.Union([t.Number(), t.Null()])),
        reviewsCount: t.Number(),
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
          if (sessionData?.user) currentUser = sessionData.user;
        } catch (error) {
          log.warn("Session validation error:", error);
        }
      }

      // Fetch user and related data
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
          products: {
            select: {
              id: true,
              status: true,
              reviews: {
                select: { rating: true },
              },
            },
          },
          followers: currentUser
            ? { where: { followerId: currentUser.id } }
            : undefined,
        },
      });

      if (!user) {
        set.status = 404;
        return { status: "error", message: "User not found" };
      }

      // Gather all reviews across user's products
      const allProductReviews = user.products.flatMap((p) => p.reviews);

      // Calculate average rating and review count
      let averageRating: number | null = null;
      let reviewsCount = allProductReviews.length;

      if (reviewsCount > 0) {
        const total = allProductReviews.reduce((sum, r) => sum + r.rating, 0);
        averageRating = Number((total / reviewsCount).toFixed(1));
      }

      // Count sold products
      const soldCount = user.products.filter((p) => p.status === "SOLD").length;

      // Determine if current user follows this user
      const isFollowing = currentUser ? user.followers.length > 0 : undefined;

      const transformedUser = {
        ...user,
        isFollowing,
        stats: {
          productsCount: user._count.products,
          soldCount,
          followersCount: user._count.followers,
          followingCount: user._count.following,
          averageRating,
          reviewsCount,
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
    params: t.Object({ id: t.String() }),
    response: UserResponseSchema,
    detail: {
      tags: ["Users"],
      summary: "Fetch user profile",
      description:
        "Fetch user profile with stats including product counts, sold items, followers, following, average rating across all reviewed products, and total reviews count.",
    },
  },
);

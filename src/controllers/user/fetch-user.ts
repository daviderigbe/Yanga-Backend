import { t } from "elysia";
import { createBaseElysia } from "../../base";
import { db } from "../../lib/db";

// Define the response type for single user

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
      userName: t.Optional(t.Union([t.String(), t.Null()])),
      enableBundleBuying: t.Boolean(),
      unavailableUntil: t.Optional(t.Union([t.String(), t.Null()])),
      createdAt: t.Union([t.String(), t.Date()]),
      updatedAt: t.Union([t.String(), t.Date()]),
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
  async ({ set, log, params }) => {
    try {
      const { id } = params;
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
        ...userData
      } = user;

      // Calculate average rating
      const averageRating =
        reviews.length > 0
          ? reviews.reduce((acc, rev) => acc + rev.rating, 0) / reviews.length
          : null;

      const transformedUser = {
        ...userData,
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
      description: "Fetch basic user information and stats",
    },
  },
);

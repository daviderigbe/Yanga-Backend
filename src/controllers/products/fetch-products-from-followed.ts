import { t } from "elysia";
import { createBaseElysia } from "../../base";
import { db } from "../../lib/db";
import { validateSessionToken } from "../../lib/auth";

export const fetchFollowedPeopleProducts = createBaseElysia().get(
  "/followed",
  async ({ set, log, query, cookie: { session } }) => {
    try {
      if (!session || !session.value) {
        set.status = 401;
        return {
          status: "error",
          message: "Authentication required to view followed users' products",
        };
      }

      const { user } = await validateSessionToken(session.value);
      if (!user) {
        set.status = 401;
        return {
          status: "error",
          message: "Invalid session",
        };
      }

      const loggedInUserId = user.id;
      const { page = "1", limit = "12" } = query;

      const currentPage = parseInt(page);
      const perPage = parseInt(limit);
      const skip = (currentPage - 1) * perPage;

      // Get IDs of people the user follows
      const following = await db.follow.findMany({
        where: {
          followerId: loggedInUserId,
        },
        select: {
          followingId: true,
        },
      });

      const followingIds = following.map((f) => f.followingId);

      if (followingIds.length === 0) {
        return {
          status: "success",
          message: "No followed users found",
          data: {
            items: [],
            pagination: {
              total: 0,
              lastPage: 1,
              currentPage,
              perPage,
              prev: null,
              next: null,
            },
          },
        };
      }

      // Find products from followed users
      const [products, total] = await Promise.all([
        db.product.findMany({
          where: {
            sellerId: { in: followingIds },
            status: "ACTIVE",
            isAvailable: true,
          },
          include: {
            images: {
              orderBy: { order: "asc" },
              select: { id: true, url: true, order: true },
            },
            category: {
              select: { id: true, name: true },
            },
            seller: {
              select: { id: true, name: true, userName: true, imageUrl: true },
            },
            _count: {
              select: { likes: true },
            },
            likes: {
              where: { userId: loggedInUserId },
              select: { id: true },
            },
            tags: {
              include: { tag: true },
            },
          },
          orderBy: { createdAt: "desc" },
          skip,
          take: perPage,
        }),
        db.product.count({
          where: {
            sellerId: { in: followingIds },
            status: "ACTIVE",
            isAvailable: true,
          },
        }),
      ]);

      // Format the products for response
      const enhancedProducts = products.map(
        ({ _count, tags: productTags, likes, ...product }) => ({
          ...product,
          tags: productTags.map(({ tag }) => tag),
          likesCount: _count.likes,
          isLiked: likes && likes.length > 0,
        }),
      );

      const lastPage = Math.ceil(total / perPage);

      return {
        status: "success",
        message: "Products from followed users retrieved successfully",
        data: {
          items: enhancedProducts,
          pagination: {
            total,
            lastPage,
            currentPage,
            perPage,
            prev: currentPage > 1 ? currentPage - 1 : null,
            next: currentPage < lastPage ? currentPage + 1 : null,
          },
        },
      };
    } catch (error) {
      log.error(error);
      set.status = 500;
      return {
        status: "error",
        message: "Failed to fetch products from followed users",
      };
    }
  },
  {
    query: t.Object({
      page: t.Optional(t.String()),
      limit: t.Optional(t.String()),
    }),
    detail: {
      tags: ["Products"],
      summary: "Fetch products from followed users",
      description:
        "Fetch products from users that the current logged-in user follows",
    },
  },
);

import { t } from "elysia";
import { createBaseElysia } from "../../base";
import { db } from "../../lib/db";
import { validateSessionToken } from "../../lib/auth";

export const fetchUserLikedProducts = createBaseElysia().get(
  "/:id/likes",
  async ({ set, log, params, query, cookie: { session } }) => {
    try {
      const { id } = params;
      const { page = "1", limit = "10" } = query;
      const currentPage = parseInt(page);
      const perPage = parseInt(limit);
      const skip = (currentPage - 1) * perPage;

      let loggedInUserId: string | undefined = undefined;
      if (session && session.value) {
        try {
          const { user } = await validateSessionToken(session.value);
          loggedInUserId = user?.id;
        } catch (error) {
          // Session validation failed but we continue without user context
          log.warn("Session validation failed");
        }
      }

      const [products, total] = await Promise.all([
        db.product.findMany({
          where: {
            likes: {
              some: {
                userId: id,
              },
            },
            status: "ACTIVE",
          },
          include: {
            images: {
              orderBy: {
                order: "asc",
              },
              select: {
                id: true,
                url: true,
                order: true,
              },
            },
            category: {
              select: {
                id: true,
                name: true,
              },
            },
            seller: {
              select: {
                id: true,
                name: true,
                userName: true,
                imageUrl: true,
              },
            },
            _count: {
              select: {
                likes: true,
              },
            },
            // Include likes for the logged-in user if available
            ...(loggedInUserId
              ? {
                  likes: {
                    where: {
                      userId: loggedInUserId,
                    },
                    select: {
                      id: true,
                    },
                  },
                }
              : {}),
          },
          skip,
          take: perPage,
          orderBy: {
            createdAt: "desc",
          },
        }),
        db.product.count({
          where: {
            likes: {
              some: {
                userId: id,
              },
            },
            status: "ACTIVE",
          },
        }),
      ]);

      const lastPage = Math.ceil(total / perPage);

      return {
        status: "success",
        message: "Liked products retrieved successfully",
        data: {
          items: products.map(({ _count, likes, ...product }) => ({
            ...product,
            likesCount: _count.likes,
            // Add isLiked field only if user is logged in
            ...(loggedInUserId ? { isLiked: likes && likes.length > 0 } : {}),
          })),
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
        message: "Failed to fetch liked products",
      };
    }
  },
  {
    query: t.Object({
      page: t.Optional(t.String()),
      limit: t.Optional(t.String()),
    }),
    params: t.Object({
      id: t.String(),
    }),
    detail: {
      tags: ["Users"],
      summary: "Fetch user liked products",
      description: "Fetch products liked by a user with pagination",
    },
  },
);

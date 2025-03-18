import { t } from "elysia";
import { createBaseElysia } from "../../base";
import { db } from "../../lib/db";
import { validateSessionToken } from "../../lib/auth";

export const fetchBestSellingProducts = createBaseElysia().get(
  "/best-selling",
  async ({ set, log, query, cookie: { session } }) => {
    try {
      const { page = "1", limit = "10" } = query;
      const currentPage = parseInt(page);
      const perPage = parseInt(limit);
      const skip = (currentPage - 1) * perPage;

      // Check if user is logged in (optional)
      let userId = null;
      if (session?.value) {
        try {
          const { user } = await validateSessionToken(session.value);
          if (user) {
            userId = user.id;
          }
        } catch (error) {
          // Silently continue if session validation fails
          // This ensures the endpoint still works for unauthenticated users
          log.error("Session validation error:", error);
        }
      }

      // Fetch best-selling products based on total order items
      const [products, total] = await Promise.all([
        db.product.findMany({
          where: {
            status: "ACTIVE",
            isAvailable: true,
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
            tags: {
              include: {
                tag: true,
              },
            },
            _count: {
              select: {
                likes: true,
                orderItems: true,
              },
            },
            // Include likes only if user is logged in
            ...(userId
              ? {
                  likes: {
                    where: {
                      userId: userId,
                    },
                    select: {
                      id: true,
                    },
                  },
                }
              : {}),
          },
          orderBy: [
            {
              orderItems: {
                _count: "desc", // Sort by number of order items (sales volume)
              },
            },
            {
              createdAt: "desc", // Secondary sort by most recent
            },
          ],
          skip,
          take: perPage,
        }),
        db.product.count({
          where: {
            status: "ACTIVE",
            isAvailable: true,
          },
        }),
      ]);

      const lastPage = Math.ceil(total / perPage);

      return {
        status: "success",
        message: "Best selling products retrieved successfully",
        data: {
          items: products.map(
            ({ _count, tags: productTags, likes, ...product }) => ({
              ...product,
              tags: productTags.map(({ tag }) => tag),
              likesCount: _count.likes,
              salesCount: _count.orderItems,
              // Add isLiked field only if user is logged in
              ...(userId ? { isLiked: likes && likes.length > 0 } : {}),
            }),
          ),
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
        message: "Failed to fetch best selling products",
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
      summary: "Fetch best selling products",
      description: "Retrieve products sorted by sales volume with pagination",
    },
  },
);

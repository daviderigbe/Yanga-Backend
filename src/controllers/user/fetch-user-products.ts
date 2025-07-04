import { t } from "elysia";
import { createBaseElysia } from "../../base";
import { db } from "../../lib/db";
import { validateSessionToken } from "../../lib/auth";

export const fetchUserProducts = createBaseElysia().get(
  "/:id/products",
  async ({ set, log, params, query, cookie: { session } }) => {
    try {
      const { id } = params;
      const { page = "1", limit = "10", status = "ACTIVE" } = query;
      const currentPage = parseInt(page);
      const perPage = parseInt(limit);
      const skip = (currentPage - 1) * perPage;

      // Get the logged-in user's ID from the session
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
            sellerId: id,
            status,
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
            categories: {
              include: {
                category: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
            _count: {
              select: {
                likes: true,
              },
            },
            likes: loggedInUserId
              ? {
                  where: {
                    userId: loggedInUserId,
                  },
                  select: {
                    id: true,
                  },
                }
              : undefined,
          },
          skip,
          take: perPage,
          orderBy: {
            createdAt: "desc",
          },
        }),
        db.product.count({
          where: {
            sellerId: id,
            status,
          },
        }),
      ]);

      const lastPage = Math.ceil(total / perPage);

      return {
        status: "success",
        message: "Products retrieved successfully",
        data: {
          items: products.map(({ _count, likes, ...product }) => ({
            ...product,
            likesCount: _count.likes,
            isLiked: loggedInUserId ? likes.length > 0 : false,
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
        message: "Failed to fetch user products",
      };
    }
  },
  {
    query: t.Object({
      page: t.Optional(t.String()),
      limit: t.Optional(t.String()),
      status: t.Optional(
        t.Enum({
          DRAFT: "DRAFT",
          ACTIVE: "ACTIVE",
          SOLD: "SOLD",
          DELETED: "DELETED",
        }),
      ),
    }),
    params: t.Object({
      id: t.String(),
    }),
    detail: {
      tags: ["Users"],
      summary: "Fetch user products",
      description: "Fetch user products with pagination and status filter",
    },
  },
);

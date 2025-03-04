import { t } from "elysia";
import { createBaseElysia } from "../../base";
import { db } from "../../lib/db";

export const fetchNewestProducts = createBaseElysia().get(
  "/products/newest",
  async ({ set, log, query }) => {
    try {
      const { page = "1", limit = "10" } = query;
      const currentPage = parseInt(page);
      const perPage = parseInt(limit);
      const skip = (currentPage - 1) * perPage;

      // Fetch newest products sorted by creation date
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
              },
            },
          },
          orderBy: {
            createdAt: "desc", // Sort by most recent first
          },
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
        message: "Newest products retrieved successfully",
        data: {
          items: products.map(({ _count, tags: productTags, ...product }) => ({
            ...product,
            tags: productTags.map(({ tag }) => tag),
            likesCount: _count.likes,
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
        message: "Failed to fetch newest products",
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
      summary: "Fetch newest products",
      description: "Retrieve recently added products with pagination",
    },
  },
);

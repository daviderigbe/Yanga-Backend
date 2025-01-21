import { t } from "elysia";
import { createBaseElysia } from "../../base";
import { db } from "../../lib/db";

export const fetchProductsByCategory = createBaseElysia().get(
  "/category/:id",
  async ({ set, log, params, query }) => {
    try {
      const { id } = params;
      const { page = "1", limit = "10" } = query;
      const currentPage = parseInt(page);
      const perPage = parseInt(limit);
      const skip = (currentPage - 1) * perPage;

      // First check if category exists
      const category = await db.category.findUnique({
        where: { id },
      });

      if (!category) {
        set.status = 404;
        return {
          status: "error",
          message: "Category not found",
        };
      }

      const [products, total] = await Promise.all([
        db.product.findMany({
          where: {
            categoryId: id,
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
            createdAt: "desc",
          },
          skip,
          take: perPage,
        }),
        db.product.count({
          where: {
            categoryId: id,
            status: "ACTIVE",
            isAvailable: true,
          },
        }),
      ]);

      const lastPage = Math.ceil(total / perPage);

      return {
        status: "success",
        message: "Products retrieved successfully",
        data: {
          category,
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
        message: "Failed to fetch products by category",
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
      tags: ["Products"],
      summary: "Fetch products by category",
      description: "Fetch products filtered by category ID with pagination",
    },
  },
);

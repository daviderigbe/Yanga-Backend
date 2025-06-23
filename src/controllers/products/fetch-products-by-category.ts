import { t } from "elysia";
import { createBaseElysia } from "../../base";
import { db } from "../../lib/db";
import { ProductStatus, Condition } from "@prisma/client";

export const fetchProductsByCategory = createBaseElysia().get(
  "/category/:id",
  async ({ set, log, params, query }) => {
    try {
      const { id } = params;
      const {
        page = "1",
        limit = "10",
        sortBy = "createdAt",
        sortOrder = "desc",
        minPrice,
        maxPrice,
        condition,
        gender,
        color,
        size,
        brandId,
      } = query;

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

      const baseWhere = {
        categoryId: id,
        status: "ACTIVE" as ProductStatus,
        isAvailable: true,
        ...(condition && { condition }),
        ...(gender && { gender }),
        ...(color && { color: { contains: color, mode: "insensitive" } }),
        ...(size && { size }),
        ...(brandId && { brandId }),
        ...(minPrice && { basePrice: { gte: parseFloat(minPrice) } }),
        ...(maxPrice && { basePrice: { lte: parseFloat(maxPrice) } }),
      };

      const [products, total] = await Promise.all([
        db.product.findMany({
          where: baseWhere,
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
            brand: {
              select: {
                id: true,
                name: true,
                logoUrl: true,
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
            [sortBy]: sortOrder,
          },
          skip,
          take: perPage,
        }),
        db.product.count({
          where: baseWhere,
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
      page: t.Optional(t.String({ default: "1" })),
      limit: t.Optional(t.String({ default: "10" })),
      sortBy: t.Optional(t.String({ default: "createdAt" })),
      sortOrder: t.Optional(
        t.Enum({ asc: "asc", desc: "desc" }, { default: "desc" }),
      ),
      minPrice: t.Optional(t.String()),
      maxPrice: t.Optional(t.String()),
      condition: t.Optional(
        t.Enum({
          NEW: "NEW",
          OPEN_BOX: "OPEN_BOX",
          LIKE_NEW: "LIKE_NEW",
          LIGHTLY_USED: "LIGHTLY_USED",
          FAIRLY_USED: "FAIRLY_USED",
          HEAVILY_USED: "HEAVILY_USED",
        }),
      ),
      gender: t.Optional(
        t.Enum({ MEN: "MEN", WOMEN: "WOMEN", UNISEX: "UNISEX" }),
      ),
      color: t.Optional(t.String()),
      size: t.Optional(t.String()),
      brandId: t.Optional(t.String()),
    }),
    params: t.Object({
      id: t.String(),
    }),
    detail: {
      tags: ["Products"],
      summary: "Fetch products by category",
      description:
        "Fetch products filtered by category ID with pagination and additional filters",
    },
  },
);

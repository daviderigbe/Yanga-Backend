import { t } from "elysia";
import { createBaseElysia } from "../../base";
import { db } from "../../lib/db";
import { validateSessionToken } from "../../lib/auth";
import { ProductStatus } from "@prisma/client";

export const fetchProductsOnSale = createBaseElysia().get(
  "/on-sale",
  async ({ set, log, query, cookie: { session } }) => {
    try {
      const {
        page = "1",
        limit = "10",
        categoryId,
        gender,
        condition,
        minDiscount,
        maxDiscount,
        minPrice,
        maxPrice,
        brand,
        color,
        size,
        sortBy = "discount", // "discount" or "price"
      } = query;

      const currentPage = parseInt(page);
      const perPage = parseInt(limit);
      const skip = (currentPage - 1) * perPage;

      let loggedInUserId: string | undefined = undefined;
      if (session && session.value) {
        try {
          const { user } = await validateSessionToken(session.value);
          loggedInUserId = user?.id;
        } catch (error) {
          log.warn("Session validation failed");
        }
      }

      // Build filter conditions for sale items
      const filters = {
        status: ProductStatus.ACTIVE,
        isAvailable: true,
        discountPercent: {
          gt: 0, // Must have some discount
          ...(minDiscount ? { gte: parseFloat(minDiscount) } : {}),
          ...(maxDiscount ? { lte: parseFloat(maxDiscount) } : {}),
        },
        ...(categoryId ? { categoryId } : {}),
        ...(gender ? { gender } : {}),
        ...(condition ? { condition } : {}),
        ...(brand ? { brand } : {}),
        ...(color ? { color } : {}),
        ...(size ? { size } : {}),
        ...(minPrice || maxPrice
          ? {
              basePrice: {
                ...(minPrice ? { gte: parseFloat(minPrice) } : {}),
                ...(maxPrice ? { lte: parseFloat(maxPrice) } : {}),
              },
            }
          : {}),
      };

      // Determine sort order
      const orderBy =
        sortBy === "price" ? { basePrice: "asc" } : { discountPercent: "desc" };

      const [products, total] = await Promise.all([
        db.product.findMany({
          where: filters,
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
            tags: {
              include: {
                tag: true,
              },
            },
            _count: {
              select: { likes: true },
            },
            ...(loggedInUserId
              ? {
                  likes: {
                    where: { userId: loggedInUserId },
                    select: { id: true },
                  },
                }
              : {}),
          },
          skip,
          take: perPage,
          // orderBy:{
          //
          // }
        }),
        db.product.count({ where: filters }),
      ]);

      const lastPage = Math.ceil(total / perPage);

      // Calculate sale prices and add to response
      const enhancedProducts = products.map(
        ({ _count, tags: productTags, likes, ...product }) => ({
          ...product,
          tags: productTags.map(({ tag }) => tag),
          likesCount: _count.likes,
          ...(loggedInUserId ? { isLiked: likes && likes.length > 0 } : {}),
        }),
      );
      const productsWithSalePrices = enhancedProducts.map((product) => {
        const discountAmount =
          parseFloat(product.basePrice.toString()) *
          (product.discountPercent! / 100);
        const salePrice =
          parseFloat(product.basePrice.toString()) - discountAmount;

        return {
          ...product,
          salePrice: parseFloat(salePrice.toFixed(2)),
        };
      });

      return {
        status: "success",
        message: "On sale products retrieved successfully",
        data: {
          items: productsWithSalePrices,
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
        message: "Failed to fetch on sale products",
      };
    }
  },
  {
    query: t.Object({
      page: t.Optional(t.String()),
      limit: t.Optional(t.String()),
      categoryId: t.Optional(t.String()),
      gender: t.Optional(
        t.Union([t.Literal("MEN"), t.Literal("WOMEN"), t.Literal("UNISEX")]),
      ),
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
      minPrice: t.Optional(t.String()),
      maxPrice: t.Optional(t.String()),
      minDiscount: t.Optional(t.String()),
      maxDiscount: t.Optional(t.String()),
      brand: t.Optional(t.String()),
      color: t.Optional(t.String()),
      size: t.Optional(t.String()),
      sortBy: t.Optional(t.Union([t.Literal("discount"), t.Literal("price")])),
    }),
    detail: {
      tags: ["Products"],
      summary: "Fetch products on sale",
      description: "Fetch products with discounts applied and optional filters",
    },
  },
);

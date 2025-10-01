import { t } from "elysia";
import { createBaseElysia } from "../../base";
import { db } from "../../lib/db";
import { validateSessionToken } from "../../lib/auth";
import { ProductStatus } from "@prisma/client";

export const fetchMostLiked = createBaseElysia().get(
  "/most-liked",
  async ({ set, log, query, cookie: { session } }) => {
    try {
      const {
        page = "1",
        limit = "10",
        categoryId,
        gender,
        condition,
        minPrice,
        maxPrice,
        brand,
        color,
        size,
        period = "all", // "day", "week", "month", "all"
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

      // Time period filter for likes
      let likeTimeFilter = {};
      if (period !== "all") {
        const now = new Date();
        let startDate = new Date();

        switch (period) {
          case "day":
            startDate.setDate(now.getDate() - 1);
            break;
          case "week":
            startDate.setDate(now.getDate() - 7);
            break;
          case "month":
            startDate.setMonth(now.getMonth() - 1);
            break;
        }

        likeTimeFilter = {
          createdAt: {
            gte: startDate,
          },
        };
      }

      // Filters
      const filters = {
        status: ProductStatus.ACTIVE,
        isAvailable: true,
        ...(categoryId
          ? {
              categories: {
                some: { categoryId },
              },
            }
          : {}),
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

      const [products, total] = await Promise.all([
        db.product.findMany({
          where: filters,
          include: {
            images: {
              orderBy: { order: "asc" },
              select: { id: true, url: true, order: true },
            },
            categories: {
              include: {
                category: {
                  select: { id: true, name: true },
                },
              },
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
              select: {
                likes:
                  period !== "all"
                    ? {
                        where: likeTimeFilter,
                      }
                    : true,
              },
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
          orderBy: {
            likes: {
              _count: "desc",
            },
          },
          skip,
          take: perPage,
        }),
        db.product.count({ where: filters }),
      ]);

      const lastPage = Math.ceil(total / perPage);

      return {
        status: "success",
        message: "Most liked products retrieved successfully",
        data: {
          items: products.map(
            ({ _count, tags: productTags, likes, categories, ...product }) => ({
              ...product,
              categories, // Keep junction-style format
              tags: productTags.map(({ tag }) => tag),
              likesCount: _count.likes,
              ...(loggedInUserId ? { isLiked: likes && likes.length > 0 } : {}),
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
        message: "Failed to fetch most liked products",
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
      brand: t.Optional(t.String()),
      color: t.Optional(t.String()),
      size: t.Optional(t.String()),
      period: t.Optional(
        t.Union([
          t.Literal("day"),
          t.Literal("week"),
          t.Literal("month"),
          t.Literal("all"),
        ]),
      ),
    }),
    detail: {
      tags: ["Products"],
      summary: "Fetch most liked products",
      description:
        "Fetch products sorted by number of likes with optional filters",
    },
  },
);

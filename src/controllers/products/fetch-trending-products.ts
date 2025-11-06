import { t } from "elysia";
import { createBaseElysia } from "../../base";
import { db } from "../../lib/db";
import { validateSessionToken } from "../../lib/auth";
import { ProductStatus, Prisma } from "@prisma/client";

export const fetchTrendingProducts = createBaseElysia().get(
  "/trending",
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

      // Trending period (last 7 days)
      const trendingPeriodStart = new Date();
      trendingPeriodStart.setDate(trendingPeriodStart.getDate() - 7);

      // Filters for the count query
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
        ...(brand
          ? {
              brand: {
                name: brand,
              },
            }
          : {}),
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

      // Raw SQL query (with categories join)
      const sqlQuery = Prisma.sql`
      SELECT p.*, 
        COUNT(DISTINCT l.id) as like_count,
        COUNT(DISTINCT v.id) as view_count,
        COUNT(DISTINCT c.id) as cart_additions
      FROM "Product" p
      LEFT JOIN "Like" l ON p."id" = l."productId" 
        AND l."createdAt" >= ${trendingPeriodStart}
      LEFT JOIN "CartItem" c ON p."id" = c."productId" 
        AND c."createdAt" >= ${trendingPeriodStart}
      LEFT JOIN "ProductView" v ON p."id" = v."productId" 
        AND v."viewedAt" >= ${trendingPeriodStart}
      LEFT JOIN "CategoriesOnProducts" cop ON p."id" = cop."productId"
      LEFT JOIN "Brand" b ON p."brandId" = b."id"
      WHERE p."status" = 'ACTIVE' AND p."isAvailable" = true
      ${categoryId ? Prisma.sql`AND cop."categoryId" = ${categoryId}` : Prisma.sql``}
      ${gender ? Prisma.sql`AND p."gender" = ${gender}::"Gender"` : Prisma.sql``}
      ${condition ? Prisma.sql`AND p."condition" = ${condition}::"Condition"` : Prisma.sql``}
      ${brand ? Prisma.sql`AND b."name" = ${brand}` : Prisma.sql``}
      ${color ? Prisma.sql`AND p."color" = ${color}` : Prisma.sql``}
      ${size ? Prisma.sql`AND p."size" = ${size}` : Prisma.sql``}
      ${minPrice ? Prisma.sql`AND p."basePrice" >= ${parseFloat(minPrice)}` : Prisma.sql``}
      ${maxPrice ? Prisma.sql`AND p."basePrice" <= ${parseFloat(maxPrice)}` : Prisma.sql``}
      GROUP BY p."id"
      ORDER BY (COUNT(DISTINCT l.id) * 3 + COUNT(DISTINCT c.id) * 2 + COUNT(DISTINCT v.id)) DESC
      LIMIT ${perPage}
      OFFSET ${skip}
    `;


      const [products, total] = await Promise.all([
        db.$queryRaw(sqlQuery),
        db.product.count({ where: filters }),
      ]);

      // Fetch full product details
      const productIds = (products as any[]).map((p) => p.id);
      const productDetails = await db.product.findMany({
        where: { id: { in: productIds } },
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
          brand: {
            select: { id: true, name: true, logoUrl: true },
          },
          seller: {
            select: { id: true, name: true, userName: true, imageUrl: true },
          },
          tags: {
            include: {
              tag: true,
            },
          },
          _count: { select: { likes: true } },
          ...(loggedInUserId
            ? {
                likes: {
                  where: { userId: loggedInUserId },
                  select: { id: true },
                },
              }
            : {}),
        },
      });

      // Map and sort products by trending score from raw query
      const trendingProducts = productDetails
        .map((product) => {
          const trendingData = (products as any[]).find(
            (p) => p.id === product.id,
          );
          return {
            ...product,
            trendingScore:
              parseInt(trendingData.like_count) * 3 +
              parseInt(trendingData.cart_additions) * 2 +
              parseInt(trendingData.view_count),
          };
        })
        .sort((a, b) => b.trendingScore - a.trendingScore);

      const lastPage = Math.ceil(total / perPage);

      return {
        status: "success",
        message: "Trending products retrieved successfully",
        data: {
          items: trendingProducts.map(
            ({ _count, tags: productTags, likes, ...product }) => ({
              ...product,
              categories: product.categories,
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
        message: "Failed to fetch trending products",
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
    }),
    detail: {
      tags: ["Products"],
      summary: "Fetch trending products",
      description:
        "Fetch products trending based on views, likes, and cart activity",
    },
  },
);

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

      // Define the trending window period (last 7 days)
      const trendingPeriodStart = new Date();
      trendingPeriodStart.setDate(trendingPeriodStart.getDate() - 7);

      // Build general filters
      const filters = {
        status: ProductStatus.ACTIVE,
        isAvailable: true,
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

      // Build SQL query conditions safely
      let sqlConditions = ["p.\"status\" = 'ACTIVE'", 'p."isAvailable" = true'];
      let sqlParams: any[] = [trendingPeriodStart, perPage, skip];

      if (categoryId) {
        sqlConditions.push('p."categoryId" = $' + (sqlParams.length + 1));
        sqlParams.push(categoryId);
      }

      if (gender) {
        sqlConditions.push('p."gender" = $' + (sqlParams.length + 1));
        sqlParams.push(gender);
      }

      if (condition) {
        sqlConditions.push('p."condition" = $' + (sqlParams.length + 1));
        sqlParams.push(condition);
      }

      if (brand) {
        sqlConditions.push('p."brand" = $' + (sqlParams.length + 1));
        sqlParams.push(brand);
      }

      if (color) {
        sqlConditions.push('p."color" = $' + (sqlParams.length + 1));
        sqlParams.push(color);
      }

      if (size) {
        sqlConditions.push('p."size" = $' + (sqlParams.length + 1));
        sqlParams.push(size);
      }

      if (minPrice) {
        sqlConditions.push('p."basePrice" >= $' + (sqlParams.length + 1));
        sqlParams.push(parseFloat(minPrice));
      }

      if (maxPrice) {
        sqlConditions.push('p."basePrice" <= $' + (sqlParams.length + 1));
        sqlParams.push(parseFloat(maxPrice));
      }

      const whereClause = sqlConditions.join(" AND ");

      // Construct the query with safely added conditions
      const sqlQuery = Prisma.sql`
        SELECT p.*, 
          COUNT(DISTINCT l.id) as like_count,
          COUNT(DISTINCT v.id) as view_count,
          COUNT(DISTINCT c.id) as cart_additions
        FROM "Product" p
        LEFT JOIN "Like" l ON p."id" = l."productId" 
          AND l."createdAt" >= ${trendingPeriodStart}::timestamp
        LEFT JOIN "CartItem" c ON p."id" = c."productId" 
          AND c."createdAt" >= ${trendingPeriodStart}::timestamp
        LEFT JOIN "ProductView" v ON p."id" = v."productId" 
          AND v."viewedAt" >= ${trendingPeriodStart}::timestamp
        WHERE ${Prisma.raw(whereClause)}
        GROUP BY p."id"
        ORDER BY (COUNT(DISTINCT l.id) * 3 + COUNT(DISTINCT c.id) * 2 + COUNT(DISTINCT v.id)) DESC
        LIMIT ${perPage}
        OFFSET ${skip}
      `;

      // Get products with recent activity
      const [products, total] = await Promise.all([
        db.$queryRaw(sqlQuery),
        db.product.count({ where: filters }),
      ]);

      // Fetch additional product details
      const productIds = products.map((p: any) => p.id);
      const productDetails = await db.product.findMany({
        where: {
          id: { in: productIds },
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
      });

      // Map and sort products by trending score from raw query
      const trendingProducts = productDetails
        .map((product) => {
          const trendingData = products.find((p: any) => p.id === product.id);
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

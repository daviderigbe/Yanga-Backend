import { t } from "elysia";
import { createBaseElysia } from "../../base";
import { db } from "../../lib/db";
import { validateSessionToken } from "../../lib/auth";
import { ProductStatus } from "@prisma/client";

export const fetchRecommendedProducts = createBaseElysia().get(
  "/recommended",
  async ({ set, log, query, cookie: { session } }) => {
    try {
      if (!session || !session.value) {
        set.status = 401;
        return {
          status: "error",
          message: "Authentication required for personalized recommendations",
        };
      }
      const { user } = await validateSessionToken(session.value);
      if (!user) {
        set.status = 401;
        return {
          status: "error",
          message: "Invalid session",
        };
      }

      const loggedInUserId = user.id;
      const { page = "1", limit = "10" } = query;

      const currentPage = parseInt(page);
      const perPage = parseInt(limit);
      const skip = (currentPage - 1) * perPage;

      // Get user's liked products to find categories and tags they prefer
      const userLikes = await db.like.findMany({
        where: { userId: loggedInUserId },
        include: {
          product: {
            include: {
              category: true,
              tags: {
                include: { tag: true },
              },
            },
          },
        },
        take: 20,
        orderBy: {
          createdAt: "desc",
        },
      });

      // Extract categories and tags from liked products
      const likedCategoryIds = Array.from(
        new Set(
          userLikes.map((like) => like.product.categoryId).filter(Boolean),
        ),
      );

      const likedTagIds = Array.from(
        new Set(
          userLikes
            .flatMap((like) => like.product.tags.map((t) => t.tagId))
            .filter(Boolean),
        ),
      );

      // Find products from similar categories or with similar tags
      const [products, total] = await Promise.all([
        db.product.findMany({
          where: {
            status: "ACTIVE",
            isAvailable: true,
            OR: [
              { categoryId: { in: likedCategoryIds } },
              likedTagIds.length > 0
                ? {
                    tags: {
                      some: {
                        tagId: { in: likedTagIds },
                      },
                    },
                  }
                : {},
            ],
            NOT: {
              id: {
                in: userLikes.map((like) => like.productId),
              },
            },
          },
          include: {
            images: {
              orderBy: { order: "asc" },
              select: { id: true, url: true, order: true },
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
            seller: {
              select: { id: true, name: true, userName: true, imageUrl: true },
            },
            _count: {
              select: { likes: true },
            },
            likes: {
              where: { userId: loggedInUserId },
              select: { id: true },
            },
            tags: {
              include: { tag: true },
            },
          },
          orderBy: [{ likes: { _count: "desc" } }, { createdAt: "desc" }],
          skip,
          take: perPage,
        }),
        db.product.count({
          where: {
            status: "ACTIVE",
            isAvailable: true,
            OR: [
              { categoryId: { in: likedCategoryIds } },
              likedTagIds.length > 0
                ? {
                    tags: {
                      some: {
                        tagId: { in: likedTagIds },
                      },
                    },
                  }
                : {},
            ],
            NOT: {
              id: {
                in: userLikes.map((like) => like.productId),
              },
            },
          },
        }),
      ]);

      // If not enough recommendation results based on likes, fall back to popular items
      let enhancedProducts = products.map(
        ({ _count, tags: productTags, likes, ...product }) => ({
          ...product,
          tags: productTags.map(({ tag }) => tag),
          likesCount: _count.likes,
          ...(loggedInUserId ? { isLiked: likes && likes.length > 0 } : {}),
        }),
      );

      if (products.length < perPage) {
        const remainingCount = perPage - products.length;
        const excludeIds = [
          ...products.map((p) => p.id),
          ...userLikes.map((l) => l.productId),
        ];

        const fallbackProducts = await db.product.findMany({
          where: {
            status: "ACTIVE",
            isAvailable: true,
            id: { notIn: excludeIds },
          },
          include: {
            images: {
              orderBy: { order: "asc" },
              select: { id: true, url: true, order: true },
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
            likes: {
              where: { userId: loggedInUserId },
              select: { id: true },
            },
          },
          orderBy: { likes: { _count: "desc" } },
          take: remainingCount,
        });

        const fallbackEnhanced = fallbackProducts.map(
          ({ _count, tags: productTags, likes, ...product }) => ({
            ...product,
            tags: productTags.map(({ tag }) => tag),
            likesCount: _count.likes,
            ...(loggedInUserId ? { isLiked: likes && likes.length > 0 } : {}),
          }),
        );
        enhancedProducts = [...enhancedProducts, ...fallbackEnhanced];
      }

      const lastPage = Math.ceil(total / perPage);

      return {
        status: "success",
        message: "Recommended products retrieved successfully",
        data: {
          items: enhancedProducts,
          pagination: {
            total: Math.max(total, enhancedProducts.length),
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
        message: "Failed to fetch recommended products",
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
      summary: "Fetch personalized product recommendations",
      description:
        "Fetch personalized product recommendations based on user's liked products",
    },
  },
);

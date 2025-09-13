import { t } from "elysia";
import { createBaseElysia } from "../../base";
import { db } from "../../lib/db";
import { validateSessionToken } from "../../lib/auth";
import { Prisma } from "@prisma/client";

// Helper function to safely parse integers
const parseIntSafely = (
  value: string | undefined,
  defaultValue: number,
): number => {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : Math.max(1, parsed);
};

// Helper function to safely parse floats
const parseFloatSafely = (value: string | undefined): number | undefined => {
  if (!value) return undefined;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? undefined : parsed;
};

// Build product search filter
const buildProductFilter = (params: {
  searchQuery: string;
  category?: string;
  minPrice?: string;
  maxPrice?: string;
  condition?: string;
  gender?: string;
}): Prisma.ProductWhereInput => {
  const { searchQuery, category, minPrice, maxPrice, condition, gender } =
    params;

  const filter: Prisma.ProductWhereInput = {
    status: "ACTIVE",
    isAvailable: true,
  };

  // Add search conditions
  if (searchQuery.trim()) {
    filter.OR = [
      { title: { contains: searchQuery, mode: "insensitive" } },
      { description: { contains: searchQuery, mode: "insensitive" } },
      { brand: { name: { contains: searchQuery, mode: "insensitive" } } },
      {
        categories: {
          some: {
            category: { name: { contains: searchQuery, mode: "insensitive" } },
          },
        },
      },
      {
        tags: {
          some: {
            tag: { name: { contains: searchQuery, mode: "insensitive" } },
          },
        },
      },
    ];
  }

  // Add filters
  if (category) {
    filter.categories = {
      some: {
        category: { name: { equals: category, mode: "insensitive" } },
      },
    };
  }

  const minPriceValue = parseFloatSafely(minPrice);
  const maxPriceValue = parseFloatSafely(maxPrice);

  if (minPriceValue !== undefined || maxPriceValue !== undefined) {
    filter.basePrice = {};
    if (minPriceValue !== undefined) filter.basePrice.gte = minPriceValue;
    if (maxPriceValue !== undefined) filter.basePrice.lte = maxPriceValue;
  }

  if (condition) filter.condition = condition as any;
  if (gender) filter.gender = gender as any;

  return filter;
};

// Build user search filter
const buildUserFilter = (searchQuery: string): Prisma.UserWhereInput => {
  const filter: Prisma.UserWhereInput = {
    isDeactivated: false,
  };

  if (searchQuery.trim()) {
    filter.OR = [
      { name: { contains: searchQuery, mode: "insensitive" } },
      { userName: { contains: searchQuery, mode: "insensitive" } },
    ];
  }

  return filter;
};

// Define types for better type safety
type ProductSearchResult = {
  id: string;
  title: string;
  description: string;
  basePrice: any;
  condition: string;
  size: string;
  gender: string;
  color: string;
  createdAt: Date;
  updatedAt: Date;
  isAvailable: boolean;
  sellerId: string;
  brandId: string | null;
  discountPercent: number | null;
  status: string;
  images: { id: string; url: string; order: number }[];
  categories: {
    productId: string;
    categoryId: string;
    category: { id: string; name: string };
  }[];
  brand: { id: string; name: string } | null;
  seller: {
    id: string;
    name: string | null;
    userName: string | null;
    imageUrl: string | null;
  };
  tags: { id: string; name: string }[];
  likesCount: number;
  isLiked?: boolean;
};

type UserSearchResult = {
  id: string;
  name: string | null;
  userName: string | null;
  imageUrl: string | null;
  bio: string | null;
  productsCount: number;
  followersCount: number;
  followingCount: number;
  isFollowing?: boolean;
};

// Search products function
const searchProducts = async (params: {
  filter: Prisma.ProductWhereInput;
  skip: number;
  take: number;
  userId?: string;
}): Promise<{ items: ProductSearchResult[]; total: number }> => {
  const { filter, skip, take, userId } = params;

  const [products, total] = await Promise.all([
    db.product.findMany({
      where: filter,
      include: {
        images: {
          orderBy: { order: "asc" },
          select: { id: true, url: true, order: true },
        },
        categories: {
          include: {
            category: { select: { id: true, name: true } },
          },
        },
        brand: {
          select: { id: true, name: true },
        },
        seller: {
          select: { id: true, name: true, userName: true, imageUrl: true },
        },
        tags: {
          include: { tag: true },
        },
        _count: {
          select: { likes: true },
        },
        ...(userId
          ? {
              likes: {
                where: { userId },
                select: { id: true },
              },
            }
          : {}),
      },
      orderBy: [{ createdAt: "desc" }],
      skip,
      take,
    }),
    db.product.count({ where: filter }),
  ]);

  return {
    items: products.map((product) => {
      const { _count, tags, likes, categories, ...rest } = product;
      return {
        ...rest,
        categories: categories.map(({ productId, categoryId, category }) => ({
          productId,
          categoryId,
          category,
        })),
        tags: tags.map(({ tag }) => tag),
        likesCount: _count.likes,
        ...(userId ? { isLiked: likes && likes.length > 0 } : {}),
      };
    }),
    total,
  };
};

// Search users function
const searchUsers = async (params: {
  filter: Prisma.UserWhereInput;
  skip: number;
  take: number;
  userId?: string;
}): Promise<{ items: UserSearchResult[]; total: number }> => {
  const { filter, skip, take, userId } = params;

  const [users, total] = await Promise.all([
    db.user.findMany({
      where: filter,
      select: {
        id: true,
        name: true,
        userName: true,
        imageUrl: true,
        bio: true,
        _count: {
          select: {
            products: {
              where: { status: "ACTIVE", isAvailable: true },
            },
            followers: true,
            following: true,
          },
        },
        ...(userId
          ? {
              followers: {
                where: { followerId: userId },
                select: { id: true },
              },
            }
          : {}),
      },
      orderBy: {
        followers: { _count: "desc" },
      },
      skip,
      take,
    }),
    db.user.count({ where: filter }),
  ]);

  return {
    items: users.map((user) => {
      const { _count, followers, ...rest } = user;
      return {
        ...rest,
        productsCount: _count.products,
        followersCount: _count.followers,
        followingCount: _count.following,
        ...(userId ? { isFollowing: followers && followers.length > 0 } : {}),
      };
    }),
    total,
  };
};

export const searchEndpoint = createBaseElysia().get(
  "",
  async ({ set, log, query, cookie: { session } }) => {
    try {
      const {
        q = "",
        type,
        page = "1",
        limit = "10",
        category,
        minPrice,
        maxPrice,
        condition,
        gender,
      } = query;

      // Validate and parse parameters
      const searchQuery = q.trim();
      const currentPage = parseIntSafely(page, 1);
      const perPage = Math.min(parseIntSafely(limit, 10), 50); // Cap at 50
      const skip = (currentPage - 1) * perPage;

      // Validate session
      let userId: string | null = null;
      if (session?.value) {
        try {
          const { user } = await validateSessionToken(session.value);
          userId = user?.id || null;
        } catch (error) {
          log.error("Session validation error:", error);
        }
      }

      // Initialize results with proper typing
      const results: {
        products: { items: ProductSearchResult[]; total: number };
        users: { items: UserSearchResult[]; total: number };
      } = {
        products: { items: [], total: 0 },
        users: { items: [], total: 0 },
      };

      // Determine search types
      const searchTypes = type ? [type] : ["products", "users"];

      // Execute searches based on type
      if (searchTypes.includes("products")) {
        const productFilter = buildProductFilter({
          searchQuery,
          category,
          minPrice,
          maxPrice,
          condition,
          gender,
        });

        results.products = await searchProducts({
          filter: productFilter,
          skip,
          take: perPage,
          userId: userId || undefined,
        });
      }

      if (searchTypes.includes("users")) {
        const userFilter = buildUserFilter(searchQuery);

        results.users = await searchUsers({
          filter: userFilter,
          skip,
          take: perPage,
          userId: userId || undefined,
        });
      }

      // Determine primary result type
      let primaryResultType: "products" | "users" = "products";
      if (type) {
        primaryResultType = type as "products" | "users";
      } else {
        primaryResultType =
          results.users.total > results.products.total ? "users" : "products";
      }

      const totalForPagination = results[primaryResultType].total;
      const lastPage = Math.ceil(totalForPagination / perPage);

      return {
        status: "success",
        message: "Search completed successfully",
        data: {
          query: searchQuery,
          primaryResultType,
          products: results.products,
          users: results.users,
          pagination: {
            total: totalForPagination,
            lastPage,
            currentPage,
            perPage,
            prev: currentPage > 1 ? currentPage - 1 : null,
            next: currentPage < lastPage ? currentPage + 1 : null,
          },
        },
      };
    } catch (error) {
      log.error("Search endpoint error:", error);
      set.status = 500;
      return {
        status: "error",
        message: "Failed to perform search",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
  {
    query: t.Object({
      q: t.Optional(t.String()),
      type: t.Optional(t.Union([t.Literal("products"), t.Literal("users")])),
      page: t.Optional(t.String()),
      limit: t.Optional(t.String()),
      category: t.Optional(t.String()),
      minPrice: t.Optional(t.String()),
      maxPrice: t.Optional(t.String()),
      condition: t.Optional(
        t.Union([
          t.Literal("NEW"),
          t.Literal("OPEN_BOX"),
          t.Literal("LIKE_NEW"),
          t.Literal("LIGHTLY_USED"),
          t.Literal("FAIRLY_USED"),
          t.Literal("HEAVILY_USED"),
        ]),
      ),
      gender: t.Optional(
        t.Union([t.Literal("MEN"), t.Literal("WOMEN"), t.Literal("UNISEX")]),
      ),
    }),
    detail: {
      tags: ["Search"],
      summary: "Unified search endpoint",
      description:
        "Search across products and users with multiple filtering options",
    },
  },
);

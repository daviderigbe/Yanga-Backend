import { t } from "elysia";
import { createBaseElysia } from "../../base";
import { db } from "../../lib/db";
import { validateSessionToken } from "../../lib/auth";
import { Prisma } from "@prisma/client";

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

      const searchQuery = q.trim();
      const currentPage = parseInt(page);
      const perPage = parseInt(limit);
      const skip = (currentPage - 1) * perPage;

      // Check if user is logged in (optional)
      let userId = null;
      if (session?.value) {
        try {
          const { user } = await validateSessionToken(session.value);
          if (user) {
            userId = user.id;
          }
        } catch (error) {
          // Silently continue if session validation fails
          log.error("Session validation error:", error);
        }
      }

      // Define results object
      const results: {
        products: { items: any[]; total: number };
        users: { items: any[]; total: number };
      } = {
        products: { items: [], total: 0 },
        users: { items: [], total: 0 },
      };

      // Determine what to search based on type parameter
      const searchTypes = type ? [type] : ["products", "users"];

      // Construct search queries in parallel
      const searchPromises = [];

      // PRODUCTS SEARCH
      if (searchTypes.includes("products")) {
        // Build product filter
        const productFilter: Prisma.ProductWhereInput = {
          AND: [{ status: "ACTIVE" }, { isAvailable: true }],
        };

        // Add search term filter
        if (searchQuery) {
          productFilter.AND.push({
            OR: [
              { title: { contains: searchQuery, mode: "insensitive" } },
              { description: { contains: searchQuery, mode: "insensitive" } },
              { brand: { contains: searchQuery, mode: "insensitive" } },
              {
                category: {
                  name: { contains: searchQuery, mode: "insensitive" },
                },
              },
              {
                tags: {
                  some: {
                    tag: {
                      name: { contains: searchQuery, mode: "insensitive" },
                    },
                  },
                },
              },
            ],
          });
        }

        // Add optional filters
        if (category) {
          productFilter.AND.push({
            category: { name: { equals: category, mode: "insensitive" } },
          });
        }

        if (minPrice) {
          productFilter.AND.push({ basePrice: { gte: parseFloat(minPrice) } });
        }

        if (maxPrice) {
          productFilter.AND.push({ basePrice: { lte: parseFloat(maxPrice) } });
        }

        if (condition) {
          productFilter.AND.push({ condition });
        }

        if (gender) {
          productFilter.AND.push({ gender });
        }

        // Products search promise
        searchPromises.push(
          Promise.all([
            db.product.findMany({
              where: productFilter,
              include: {
                images: {
                  orderBy: { order: "asc" },
                  select: { id: true, url: true, order: true },
                },
                category: {
                  select: { id: true, name: true },
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
              orderBy: [
                // First by creation date (newest first)
                { createdAt: "desc" },
              ],
              skip,
              take: perPage,
            }),
            db.product.count({ where: productFilter }),
          ]).then(([products, total]) => {
            results.products.items = products.map((product) => {
              const {
                _count,
                tags: productTags,
                likes,
                ...restProduct
              } = product;
              return {
                ...restProduct,
                tags: productTags.map(({ tag }) => tag),
                likesCount: _count.likes,
                ...(userId ? { isLiked: likes && likes.length > 0 } : {}),
              };
            });
            results.products.total = total;
          }),
        );
      }

      // USERS SEARCH
      if (searchTypes.includes("users")) {
        // Users search promise
        searchPromises.push(
          Promise.all([
            db.user.findMany({
              where: {
                AND: [
                  { isDeactivated: false },
                  {
                    OR: [
                      { name: { contains: searchQuery, mode: "insensitive" } },
                      {
                        userName: {
                          contains: searchQuery,
                          mode: "insensitive",
                        },
                      },
                    ],
                  },
                ],
              },
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
              orderBy: [
                // By followers count (most popular first)
                { followers: { _count: "desc" } },
              ],
              skip,
              take: perPage,
            }),
            db.user.count({
              where: {
                AND: [
                  { isDeactivated: false },
                  {
                    OR: [
                      { name: { contains: searchQuery, mode: "insensitive" } },
                      {
                        userName: {
                          contains: searchQuery,
                          mode: "insensitive",
                        },
                      },
                    ],
                  },
                ],
              },
            }),
          ]).then(([users, total]) => {
            results.users.items = users.map((user) => {
              const { _count, followers, ...restUser } = user;
              return {
                ...restUser,
                productsCount: _count.products,
                followersCount: _count.followers,
                followingCount: _count.following,
                ...(userId
                  ? { isFollowing: followers && followers.length > 0 }
                  : {}),
              };
            });
            results.users.total = total;
          }),
        );
      }

      // Execute all search promises
      await Promise.all(searchPromises);

      // Determine which result type has the most matches
      let primaryResultType: "products" | "users" = "products";
      let maxResults = results.products.total;

      if (results.users.total > maxResults) {
        primaryResultType = "users";
        maxResults = results.users.total;
      }

      // Calculate pagination for the primary result type
      const total = results[primaryResultType].total;
      const lastPage = Math.ceil(total / perPage);

      // Return search results
      return {
        status: "success",
        message: "Search completed successfully",
        data: {
          query: searchQuery,
          primaryResultType:
            (type as "products" | "users" | undefined) || primaryResultType,
          products: results.products,
          users: results.users,
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

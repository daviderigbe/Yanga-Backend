import { t } from "elysia";
import { createBaseElysia } from "../../base";
import { db } from "../../lib/db";
import { validateSessionToken } from "../../lib/auth";

export const fetchVendors = createBaseElysia().get(
  "/vendors",
  async ({ set, log, query, cookie: { session } }) => {
    try {
      const {
        page = "1",
        limit = "10",
        search = "",
        category = "",
        orderBy = "popular", // popular, newest, products
        minProducts = "0",
        withAvailableProducts = "true",
      } = query;

      const currentPage = parseInt(page);
      const perPage = parseInt(limit);
      const skip = (currentPage - 1) * perPage;
      const minProductCount = parseInt(minProducts);
      const onlyWithAvailableProducts = withAvailableProducts === "true";

      // Get user ID if logged in (for follow status)
      let loggedInUserId: string | null = null;
      if (session && session.value) {
        try {
          const { user } = await validateSessionToken(session.value);
          if (user) {
            loggedInUserId = user.id;
          }
        } catch (error) {
          // Silently continue without user context
        }
      }

      // Build where conditions
      const whereConditions: any = {
        isDeactivated: false,
        userUnavailable: false,
        products: {
          some: {},
        },
      };

      // Add search condition if provided
      if (search) {
        whereConditions.OR = [
          { name: { contains: search, mode: "insensitive" } },
          { userName: { contains: search, mode: "insensitive" } },
          { bio: { contains: search, mode: "insensitive" } },
        ];
      }

      // Only include vendors with available products if specified
      if (onlyWithAvailableProducts) {
        whereConditions.products.some = {
          status: "ACTIVE",
          isAvailable: true,
        };
      }

      // Add category filter if specified
      if (category) {
        whereConditions.products.some = {
          ...whereConditions.products.some,
          category: {
            name: { equals: category, mode: "insensitive" },
          },
        };
      }

      // Define ordering based on request
      let orderByCondition: any[] = [];

      switch (orderBy) {
        case "newest":
          orderByCondition = [{ createdAt: "desc" }];
          break;
        case "products":
          orderByCondition = [
            {
              products: {
                _count: "desc",
              },
            },
          ];
          break;
        case "popular":
        default:
          orderByCondition = [
            {
              followers: {
                _count: "desc",
              },
            },
            {
              products: {
                _count: "desc",
              },
            },
          ];
          break;
      }

      // First get all vendors that meet the conditions
      const vendors = await db.user.findMany({
        where: whereConditions,
        select: {
          id: true,
          name: true,
          userName: true,
          imageUrl: true,
          bio: true,
          createdAt: true,
          _count: {
            select: {
              products: {
                where: onlyWithAvailableProducts
                  ? { status: "ACTIVE", isAvailable: true }
                  : {},
              },
              followers: true,
            },
          },
          products: {
            where: onlyWithAvailableProducts
              ? { status: "ACTIVE", isAvailable: true }
              : {},
            select: {
              _count: {
                select: {
                  likes: true,
                  reviews: true,
                },
              },
            },
            take: 50, // Limit to avoid excessive counting
          },
          ...(loggedInUserId
            ? {
                followers: {
                  where: {
                    followerId: loggedInUserId,
                  },
                  select: {
                    id: true,
                  },
                },
              }
            : {}),
        },
        orderBy: orderByCondition,
      });

      // Filter vendors with minimum product count and format them
      const filteredVendors = vendors
        .filter((vendor) => vendor._count.products >= minProductCount)
        .map((vendor) => {
          // Calculate engagement metrics
          const totalLikes = vendor.products.reduce(
            (sum, product) => sum + product._count.likes,
            0,
          );

          const totalReviews = vendor.products.reduce(
            (sum, product) => sum + product._count.reviews,
            0,
          );

          const averageLikes =
            vendor.products.length > 0
              ? totalLikes / vendor.products.length
              : 0;

          return {
            id: vendor.id,
            name: vendor.name,
            userName: vendor.userName,
            imageUrl: vendor.imageUrl,
            bio: vendor.bio,
            createdAt: vendor.createdAt,
            productsCount: vendor._count.products,
            followersCount: vendor._count.followers,
            averageLikes: Math.round(averageLikes * 10) / 10,
            totalLikes,
            totalReviews,
            engagementScore: totalLikes + totalReviews * 3,
            ...(loggedInUserId
              ? { isFollowing: vendor.followers && vendor.followers.length > 0 }
              : {}),
          };
        });

      // Apply any custom sorting for combined metrics if needed
      if (orderBy === "engagement") {
        filteredVendors.sort((a, b) => b.engagementScore - a.engagementScore);
      }

      // Apply pagination manually after filtering
      const total = filteredVendors.length;
      const paginatedVendors = filteredVendors.slice(skip, skip + perPage);
      const lastPage = Math.ceil(total / perPage);

      return {
        status: "success",
        message: "Vendors retrieved successfully",
        data: {
          items: paginatedVendors,
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
      log.error("fetch vendors error:", error);
      set.status = 500;
      return {
        status: "error",
        message: "Failed to fetch vendors",
      };
    }
  },
  {
    query: t.Object({
      page: t.Optional(t.String()),
      limit: t.Optional(t.String()),
      search: t.Optional(t.String()),
      category: t.Optional(t.String()),
      orderBy: t.Optional(
        t.Union([
          t.Literal("popular"),
          t.Literal("newest"),
          t.Literal("products"),
          t.Literal("engagement"),
        ]),
      ),
      minProducts: t.Optional(t.String()),
      withAvailableProducts: t.Optional(t.String()),
    }),
    detail: {
      tags: ["Vendors"],
      summary: "Fetch vendors",
      description: "Fetch vendors with various filtering and sorting options",
    },
  },
);

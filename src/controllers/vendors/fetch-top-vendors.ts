import { t } from "elysia";
import { createBaseElysia } from "../../base";
import { db } from "../../lib/db";
import { validateSessionToken } from "../../lib/auth";

// Endpoint to fetch top vendors based on product likes and reviews
export const fetchTopVendors = createBaseElysia().get(
  "/top",
  async ({ set, log, query, cookie: { session } }) => {
    try {
      const { page = "1", limit = "10" } = query;

      const currentPage = parseInt(page);
      const perPage = parseInt(limit);
      const skip = (currentPage - 1) * perPage;

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

      // Find top vendors based on product popularity (likes count) and reviews
      const [vendors, total] = await Promise.all([
        db.user.findMany({
          where: {
            products: {
              some: {
                status: "ACTIVE",
                isAvailable: true,
              },
            },
          },
          select: {
            id: true,
            name: true,
            userName: true,
            imageUrl: true,
            bio: true,
            userUnavailable: true,
            _count: {
              select: {
                products: {
                  where: {
                    status: "ACTIVE",
                    isAvailable: true,
                  },
                },
                followers: true,
              },
            },
            products: {
              where: {
                status: "ACTIVE",
                isAvailable: true,
              },
              select: {
                _count: {
                  select: {
                    likes: true,
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
          orderBy: [
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
          ],
          skip,
          take: perPage,
        }),
        db.user.count({
          where: {
            products: {
              some: {
                status: "ACTIVE",
                isAvailable: true,
              },
            },
          },
        }),
      ]);

      // Calculate average likes per product and format response
      const enhancedVendors = vendors.map((vendor) => {
        // Calculate total likes across all products
        const totalLikes = vendor.products.reduce(
          (sum, product) => sum + product._count.likes,
          0,
        );

        // Calculate average likes per product
        const averageLikes =
          vendor.products.length > 0 ? totalLikes / vendor.products.length : 0;

        return {
          id: vendor.id,
          name: vendor.name,
          userName: vendor.userName,
          imageUrl: vendor.imageUrl,
          bio: vendor.bio,
          userUnavailable: vendor.userUnavailable,
          productsCount: vendor._count.products,
          followersCount: vendor._count.followers,
          averageLikes: Math.round(averageLikes * 10) / 10, // Round to 1 decimal place
          ...(loggedInUserId
            ? { isFollowing: vendor.followers && vendor.followers.length > 0 }
            : {}),
        };
      });

      // Sort by a combination of followers and average likes
      enhancedVendors.sort((a, b) => {
        const scoreA = a.followersCount * 2 + a.averageLikes * 5;
        const scoreB = b.followersCount * 2 + b.averageLikes * 5;
        return scoreB - scoreA;
      });

      const lastPage = Math.ceil(total / perPage);

      return {
        status: "success",
        message: "Top vendors retrieved successfully",
        data: {
          items: enhancedVendors,
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
        message: "Failed to fetch top vendors",
      };
    }
  },
  {
    query: t.Object({
      page: t.Optional(t.String()),
      limit: t.Optional(t.String()),
    }),
    detail: {
      tags: ["Vendors"],
      summary: "Fetch top vendors",
      description:
        "Fetch top vendors based on product popularity and follower count",
    },
  },
);

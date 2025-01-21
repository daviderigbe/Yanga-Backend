import { t } from "elysia";
import { createBaseElysia } from "../../base";
import { db } from "../../lib/db";

// Define the response type for single user
const SingleUserResponseSchema = t.Object({
  status: t.Enum({ success: "success", error: "error" }),
  message: t.String(),
  data: t.Optional(
    t.Object({
      id: t.String(),
      name: t.Optional(t.String()),
      email: t.String(),
      imageUrl: t.Optional(t.String()),
      bio: t.Optional(t.String()),
      userName: t.Optional(t.String()),
      bankName: t.Optional(t.String()),
      bankCode: t.Optional(t.String()),
      bankAccountName: t.Optional(t.String()),
      enableBundleBuying: t.Boolean(),
      unavailableUntil: t.Optional(t.String()),
      createdAt: t.String(),
      updatedAt: t.String(),

      // Related data counts
      productsCount: t.Number(),
      followersCount: t.Number(),
      followingCount: t.Number(),

      // Products they're selling
      products: t.Array(
        t.Object({
          id: t.String(),
          title: t.String(),
          basePrice: t.Number(),
          discountPercent: t.Optional(t.Number()),
          status: t.Enum({
            DRAFT: "DRAFT",
            ACTIVE: "ACTIVE",
            SOLD: "SOLD",
            DELETED: "DELETED",
          }),
          images: t.Array(
            t.Object({
              id: t.String(),
              url: t.String(),
              order: t.Number(),
            }),
          ),
        }),
      ),

      // Addresses
      addresses: t.Array(
        t.Object({
          id: t.String(),
          type: t.Enum({
            BILLING: "BILLING",
            SHIPPING: "SHIPPING",
          }),
          street: t.String(),
          city: t.String(),
          state: t.String(),
          country: t.String(),
          zipCode: t.String(),
          isDefault: t.Boolean(),
        }),
      ),
    }),
  ),
});

export const fetchUserById = createBaseElysia().get(
  "/:id",
  async ({ set, log, params }) => {
    try {
      const { id } = params;
      const user = await db.user.findUnique({
        where: {
          id: id,
        },
        include: {
          products: {
            where: {
              status: "ACTIVE",
            },
            select: {
              id: true,
              title: true,
              basePrice: true,
              discountPercent: true,
              status: true,
              images: {
                select: {
                  id: true,
                  url: true,
                  order: true,
                },
                orderBy: {
                  order: "asc",
                },
              },
            },
            take: 10, // Limit to latest 10 products
            orderBy: {
              createdAt: "desc",
            },
          },
          addresses: {
            select: {
              id: true,
              type: true,
              street: true,
              city: true,
              state: true,
              country: true,
              zipCode: true,
              isDefault: true,
            },
          },
          followers: {
            select: {
              id: true,
            },
          },
          following: {
            select: {
              id: true,
            },
          },
          _count: {
            select: {
              products: true,
            },
          },
        },
      });

      if (!user) {
        set.status = 404;
        return {
          status: "error",
          message: "User not found",
        };
      }

      // Transform the data to match the schema
      const {
        password, // Remove sensitive data
        googleId,
        appleId,
        followers,
        following,
        _count,
        ...userData
      } = user;

      const transformedUser = {
        ...userData,
        productsCount: _count.products,
        followersCount: followers.length,
        followingCount: following.length,
      };

      set.status = "OK";
      return {
        status: "success",
        message: "User retrieved successfully",
        data: transformedUser,
      };
    } catch (error) {
      log.error(error);
      set.status = 500;
      return {
        status: "error",
        message: "Failed to fetch user",
      };
    }
  },
  {
    params: t.Object({
      id: t.String(),
    }),
    response: SingleUserResponseSchema,
    detail: {
      tags: ["Users"],
      summary: "Fetch user by id",
      description:
        "Fetch a single user by ID with their products, addresses, and social stats",
    },
  },
);

import { t } from "elysia";
import { createBaseElysia } from "../../base";
import { validateSessionToken } from "../../lib/auth";
import { db } from "../../lib/db";

export const purchaseHistory = createBaseElysia().get(
  "",
  async ({ query, set, log, cookie: { session } }) => {
    try {
      if (!session.value) {
        set.status = "Bad Request";
        return {
          status: "error",
          message: "Session not found",
        };
      }

      const { session: dbSession, user } = await validateSessionToken(
        session.value,
      );

      if (!dbSession || !user) {
        set.status = "Unauthorized";
        return {
          status: "error",
          message: "Invalid session",
        };
      }

      const page = query.page || 1;
      const limit = query.limit || 10;
      const skip = (page - 1) * limit;

      // Get orders made by this user
      const purchasesQuery = {
        buyerId: user.id,
        ...(query.status && { status: query.status }),
        ...(query.dateFrom &&
          query.dateTo && {
            createdAt: {
              gte: new Date(query.dateFrom),
              lte: new Date(query.dateTo),
            },
          }),
      };

      const [purchases, totalCount] = await Promise.all([
        db.order.findMany({
          where: purchasesQuery,
          include: {
            items: {
              include: {
                product: {
                  select: {
                    id: true,
                    title: true,
                    images: {
                      take: 1,
                      orderBy: { order: "asc" },
                      select: {
                        url: true,
                      },
                    },
                    seller: {
                      select: {
                        id: true,
                        name: true,
                        userName: true,
                        imageUrl: true,
                      },
                    },
                  },
                },
              },
            },
            address: {
              select: {
                street: true,
                city: true,
                state: true,
                country: true,
                zipCode: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
        db.order.count({
          where: purchasesQuery,
        }),
      ]);

      // Format response
      const formattedPurchases = purchases.map((purchase) => ({
        id: purchase.id,
        status: purchase.status,
        isBundle: purchase.isBundle,
        totalAmount: purchase.totalAmount,
        discountCode: purchase.discountCode,
        shippingAddress: purchase.address,
        items: purchase.items.map((item) => ({
          id: item.id,
          product: {
            id: item.product.id,
            title: item.product.title,
            image: item.product.images[0]?.url || null,
            seller: item.product.seller,
          },
          quantity: item.quantity,
          price: item.price,
          total: Number(item.price) * item.quantity,
        })),
        createdAt: purchase.createdAt,
        updatedAt: purchase.updatedAt,
      }));

      // Calculate summary statistics
      const totalSpent = await db.order.aggregate({
        where: {
          buyerId: user.id,
          status: {
            in: ["DELIVERED", "PROCESSING", "SHIPPED"],
          },
        },
        _sum: {
          totalAmount: true,
        },
        _count: {
          id: true,
        },
      });

      const totalItems = await db.orderItem.count({
        where: {
          order: {
            buyerId: user.id,
            status: {
              in: ["DELIVERED", "PROCESSING", "SHIPPED"],
            },
          },
        },
      });

      const summary = {
        totalSpent: totalSpent._sum.totalAmount || 0,
        totalItemsPurchased: totalItems,
        totalOrders: totalCount,
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        hasNextPage: page < Math.ceil(totalCount / limit),
        hasPrevPage: page > 1,
      };

      set.status = "OK";
      return {
        status: "success",
        message: "Purchase history retrieved successfully",
        data: {
          purchases: formattedPurchases,
          summary,
        },
      };
    } catch (error) {
      log.error("Get purchase history error:", error);
      set.status = 500;
      return {
        status: "error",
        message: "An error occurred while retrieving purchase history",
      };
    }
  },
  {
    query: t.Optional(
      t.Object({
        page: t.Optional(t.Number({ minimum: 1, default: 1 })),
        limit: t.Optional(t.Number({ minimum: 1, maximum: 50, default: 10 })),
        status: t.Optional(
          t.Union([
            t.Literal("PENDING"),
            t.Literal("PROCESSING"),
            t.Literal("SHIPPED"),
            t.Literal("DELIVERED"),
            t.Literal("CANCELLED"),
            t.Literal("REFUNDED"),
          ]),
        ),
        dateFrom: t.Optional(t.String({ format: "date" })),
        dateTo: t.Optional(t.String({ format: "date" })),
      }),
    ),
    detail: {
      tags: ["Purchases"],
      summary: "Get purchase history",
      description: "Get user's purchase history with filtering and pagination",
    },
  },
);

import { t } from "elysia";
import { createBaseElysia } from "../../base";
import { validateSessionToken } from "../../lib/auth";
import { db } from "../../lib/db";

export const saleHistory = createBaseElysia().get(
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

      // Get orders that contain products sold by this user
      const salesQuery = {
        items: {
          some: {
            product: {
              sellerId: user.id,
            },
          },
        },
        ...(query.status && { status: query.status }),
        ...(query.dateFrom &&
          query.dateTo && {
            createdAt: {
              gte: new Date(query.dateFrom),
              lte: new Date(query.dateTo),
            },
          }),
      };

      const [sales, totalCount] = await Promise.all([
        db.order.findMany({
          where: salesQuery,
          include: {
            buyer: {
              select: {
                id: true,
                name: true,
                userName: true,
                email: true,
                imageUrl: true,
              },
            },
            items: {
              where: {
                product: {
                  sellerId: user.id,
                },
              },
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
          where: salesQuery,
        }),
      ]);

      // Calculate totals and format response
      const formattedSales = sales.map((sale) => {
        const userItems = sale.items;
        const itemsTotal = userItems.reduce(
          (sum, item) => sum + Number(item.price) * item.quantity,
          0,
        );

        return {
          id: sale.id,
          buyer: sale.buyer,
          status: sale.status,
          itemsCount: userItems.length,
          totalAmount: itemsTotal,
          discountCode: sale.discountCode,
          shippingAddress: sale.address,
          items: userItems.map((item) => ({
            id: item.id,
            product: {
              id: item.product.id,
              title: item.product.title,
              image: item.product.images[0]?.url || null,
            },
            quantity: item.quantity,
            price: item.price,
            total: Number(item.price) * item.quantity,
          })),
          createdAt: sale.createdAt,
          updatedAt: sale.updatedAt,
        };
      });

      // Calculate summary statistics
      const totalSales = await db.orderItem.aggregate({
        where: {
          product: {
            sellerId: user.id,
          },
          order: {
            status: {
              in: ["DELIVERED", "PROCESSING", "SHIPPED"],
            },
          },
        },
        _sum: {
          price: true,
        },
        _count: {
          id: true,
        },
      });

      const summary = {
        totalSalesAmount: totalSales._sum.price || 0,
        totalItemsSold: totalSales._count || 0,
        totalOrders: totalCount,
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        hasNextPage: page < Math.ceil(totalCount / limit),
        hasPrevPage: page > 1,
      };

      set.status = "OK";
      return {
        status: "success",
        message: "Sale history retrieved successfully",
        data: {
          sales: formattedSales,
          summary,
        },
      };
    } catch (error) {
      log.error("Get sale history error:", error);
      set.status = 500;
      return {
        status: "error",
        message: "An error occurred while retrieving sale history",
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
      tags: ["Sales"],
      summary: "Get sale history",
      description: "Get user's sales history with filtering and pagination",
    },
  },
);

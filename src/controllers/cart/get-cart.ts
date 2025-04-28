import { createBaseElysia } from "../../base";
import { validateSessionToken } from "../../lib/auth";
import { db } from "../../lib/db";

export const getCart = createBaseElysia().get(
  "",
  async ({ set, log, cookie: { session } }) => {
    try {
      if (!session.value) {
        set.status = "Bad Request";
        return { status: "error", message: "Session not found" };
      }

      const { session: dbSession, user } = await validateSessionToken(
        session.value,
      );

      if (!dbSession || !user) {
        set.status = "Unauthorized";
        return { status: "error", message: "Invalid session" };
      }

      // Find or create cart
      let cart = await db.cart.findUnique({
        where: { userId: user.id },
        include: {
          items: {
            include: {
              product: {
                include: {
                  images: true,
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
        },
      });

      if (!cart) {
        cart = await db.cart.create({
          data: {
            userId: user.id,
          },
          include: {
            items: {
              include: {
                product: {
                  include: {
                    images: true,
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
          },
        });
      }

      // Group cart items by seller
      const groupedBySellerItems = cart.items.reduce((result, item) => {
        const sellerId = item.product.seller.id;

        if (!result[sellerId]) {
          result[sellerId] = {
            seller: item.product.seller,
            items: [],
          };
        }

        result[sellerId].items.push(item);
        return result;
      }, {});

      // Convert to array structure
      const sellerGroups = Object.values(groupedBySellerItems);

      return {
        status: "success",
        data: {
          id: cart.id,
          userId: cart.userId,
          createdAt: cart.createdAt,
          updatedAt: cart.updatedAt,
          sellerGroups: sellerGroups,
          // Keep the original items array for backward compatibility
          items: cart.items,
        },
      };
    } catch (error) {
      log.error("get cart error:", error);
      set.status = 500;
      return {
        status: "error",
        message: "An error occurred while fetching the cart",
      };
    }
  },
  {
    detail: {
      tags: ["Cart"],
      summary: "Get user's cart",
      description:
        "Retrieve the current user's shopping cart with items grouped by seller",
    },
  },
);

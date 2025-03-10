import { t } from "elysia";
import { createBaseElysia } from "../../base";
import { validateSessionToken } from "../../lib/auth";
import { db } from "../../lib/db";

export const addToCart = createBaseElysia().post(
  "",
  async ({ body, set, log, cookie: { session } }) => {
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

      // Verify product exists
      const product = await db.product.findUnique({
        where: { id: body.productId },
      });

      if (!product) {
        set.status = "Not Found";
        return {
          status: "error",
          message: "Product not found",
        };
      }

      // Don't allow users to add their own products to cart
      if (product.sellerId === user.id) {
        set.status = "Bad Request";
        return {
          status: "error",
          message: "You cannot add your own product to your cart",
        };
      }

      // Check if product is available
      if (!product.isAvailable || product.status !== "ACTIVE") {
        set.status = "Bad Request";
        return {
          status: "error",
          message: "This product is currently unavailable",
        };
      }

      // Find or create user's cart
      let cart = await db.cart.findUnique({
        where: { userId: user.id },
      });

      if (!cart) {
        cart = await db.cart.create({
          data: { userId: user.id },
        });
      }

      // Check if item already exists in cart
      const existingItem = await db.cartItem.findUnique({
        where: {
          cartId_productId: {
            cartId: cart.id,
            productId: body.productId,
          },
        },
      });

      if (existingItem) {
        // Update quantity if item already exists
        await db.cartItem.update({
          where: { id: existingItem.id },
          data: {
            quantity: existingItem.quantity + body.quantity,
            updatedAt: new Date(),
          },
        });
      } else {
        // Add new item to cart
        await db.cartItem.create({
          data: {
            cartId: cart.id,
            productId: body.productId,
            quantity: body.quantity,
          },
        });
      }

      // Get updated cart with items
      const updatedCart = await db.cart.findUnique({
        where: { id: cart.id },
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

      set.status = "OK";
      return {
        status: "success",
        message: "Item added to cart successfully",
        data: updatedCart,
      };
    } catch (error) {
      log.error("Add to cart error:", error);
      set.status = 500;
      return {
        status: "error",
        message: "An error occurred while adding the item to cart",
      };
    }
  },
  {
    body: t.Object({
      productId: t.String(),
      quantity: t.Number({
        minimum: 1,
        maximum: 10,
        default: 1,
        error: "Quantity must be between 1 and 10 items.",
      }),
    }),
    detail: {
      tags: ["Cart"],
      summary: "Add to cart",
      description: "Add a product to the user's shopping cart",
    },
  },
);

import { t } from "elysia";
import { createBaseElysia } from "../../base";
import { validateSessionToken } from "../../lib/auth";
import { db } from "../../lib/db";

export const updateCartItem = createBaseElysia().put(
  "/items/:itemId",
  async ({ body, set, log, cookie: { session }, params }) => {
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

      // Find user's cart
      const cart = await db.cart.findUnique({
        where: { userId: user.id },
      });

      if (!cart) {
        set.status = "Not Found";
        return { status: "error", message: "Cart not found" };
      }

      // Check if the item exists and belongs to the user's cart
      const existingItem = await db.cartItem.findFirst({
        where: {
          id: params.itemId,
          cartId: cart.id,
        },
      });

      if (!existingItem) {
        set.status = "Not Found";
        return { status: "error", message: "Cart item not found" };
      }

      // Update the item quantity
      const updatedItem = await db.cartItem.update({
        where: { id: params.itemId },
        data: {
          quantity: body.quantity,
          updatedAt: new Date(),
        },
        include: {
          product: true,
        },
      });

      return {
        status: "success",
        message: "Cart item updated successfully",
        data: updatedItem,
      };
    } catch (error) {
      log.error("update cart item error:", error);
      set.status = 500;
      return {
        status: "error",
        message: "An error occurred while updating the cart item",
      };
    }
  },
  {
    body: t.Object({
      quantity: t.Number({ minimum: 1 }),
    }),
    params: t.Object({
      itemId: t.String(),
    }),
    detail: {
      tags: ["Cart"],
      summary: "Update cart item",
      description: "Update the quantity of an item in the cart",
    },
  },
);

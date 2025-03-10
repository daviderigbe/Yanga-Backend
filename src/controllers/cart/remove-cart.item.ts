import { t } from "elysia";
import { createBaseElysia } from "../../base";
import { validateSessionToken } from "../../lib/auth";
import { db } from "../../lib/db";

export const removeCartItem = createBaseElysia().delete(
  "/items/:itemId",
  async ({ set, log, cookie: { session }, params }) => {
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

      // Delete the item
      await db.cartItem.delete({
        where: { id: params.itemId },
      });

      return {
        status: "success",
        message: "Item removed from cart successfully",
      };
    } catch (error) {
      log.error("remove cart item error:", error);
      set.status = 500;
      return {
        status: "error",
        message: "An error occurred while removing the item from cart",
      };
    }
  },
  {
    params: t.Object({
      itemId: t.String(),
    }),
    detail: {
      tags: ["Cart"],
      summary: "Remove cart item",
      description: "Remove an item from the shopping cart",
    },
  },
);

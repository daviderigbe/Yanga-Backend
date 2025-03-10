import { t } from "elysia";
import { createBaseElysia } from "../../base";
import { validateSessionToken } from "../../lib/auth";
import { db } from "../../lib/db";

export const clearCart = createBaseElysia().delete(
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

      // Find user's cart
      const cart = await db.cart.findUnique({
        where: { userId: user.id },
      });

      if (!cart) {
        set.status = "Not Found";
        return { status: "error", message: "Cart not found" };
      }

      // Delete all items from the cart
      await db.cartItem.deleteMany({
        where: { cartId: cart.id },
      });

      return {
        status: "success",
        message: "Cart cleared successfully",
      };
    } catch (error) {
      log.error("clear cart error:", error);
      set.status = 500;
      return {
        status: "error",
        message: "Something went wrong",
      };
    }
  },
  {
    detail: {
      tags: ["Cart"],
      summary: "Clear cart",
      description: "Remove all items from the shopping cart",
    },
  },
);

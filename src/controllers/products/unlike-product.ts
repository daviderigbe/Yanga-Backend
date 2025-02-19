import { t } from "elysia";
import { createBaseElysia } from "../../base";
import { validateSessionToken } from "../../lib/auth";
import { db } from "../../lib/db";

export const unlikeProduct = createBaseElysia().delete(
  ":id/like",
  async ({ set, log, cookie: { session }, params }) => {
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

      const existingProduct = await db.product.findUnique({
        where: { id: params.id },
      });

      if (!existingProduct) {
        set.status = "Not Found";
        return {
          status: "error",
          message: "Product not found",
        };
      }

      // Find the existing like
      const existingLike = await db.like.findUnique({
        where: {
          userId_productId: {
            userId: user.id,
            productId: params.id,
          },
        },
      });

      if (!existingLike) {
        set.status = "Not Found";
        return {
          status: "error",
          message: "You haven't liked this product",
        };
      }

      // Delete the like
      await db.like.delete({
        where: {
          userId_productId: {
            userId: user.id,
            productId: params.id,
          },
        },
      });

      return {
        status: "success",
        message: "Product unliked successfully",
      };
    } catch (error) {
      log.error("product unlike error:", error);
      set.status = 500;
      return {
        status: "error",
        message: "An error occurred while unliking the product",
      };
    }
  },
  {
    params: t.Object({
      id: t.String(),
    }),
    detail: {
      tags: ["Products"],
      summary: "Unlike a product",
      description: "Remove a like from a product",
    },
  },
);

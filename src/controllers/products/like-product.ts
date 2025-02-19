import { t } from "elysia";
import { createBaseElysia } from "../../base";
import { validateSessionToken } from "../../lib/auth";
import { db } from "../../lib/db";

export const likeProduct = createBaseElysia().post(
  ":id/like",
  async ({ body, set, log, cookie: { session }, params }) => {
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

      // Check if user has already liked the product
      const existingLike = await db.like.findUnique({
        where: {
          userId_productId: {
            userId: user.id,
            productId: params.id,
          },
        },
      });

      if (existingLike) {
        set.status = "Bad Request";
        return {
          status: "error",
          message: "You have already liked this product",
        };
      }

      // Create the like
      const like = await db.like.create({
        data: {
          userId: user.id,
          productId: params.id,
        },
      });

      //TODO: Create notification for product owner if they're not the one liking
      /***      if (existingProduct.sellerId !== user.id) {
        await db.notification.create({
          data: {
            userId: existingProduct.sellerId,
            type: "NEW_PRODUCT_FROM_FOLLOWING",
            content: `${user.name || "Someone"} liked your product "${existingProduct.title}"`,
          },
        });
      }
    ***/

      return {
        status: "success",
        message: "Product liked successfully",
        data: like,
      };
    } catch (error) {
      log.error("product like error:", error);
      set.status = 500;
      return {
        status: "error",
        message: "An error occurred while liking the product",
      };
    }
  },
  {
    params: t.Object({
      id: t.String(),
    }),
    detail: {
      tags: ["Products"],
      summary: "Like a product",
    },
  },
);

import { t } from "elysia";
import { createBaseElysia } from "../../base";
import { validateSessionToken } from "../../lib/auth";
import { db } from "../../lib/db";

// Remove image from product
export const removeProductImage = createBaseElysia().delete(
  ":productId/images/:imageId",
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

      const image = await db.productImage.findUnique({
        where: { id: params.imageId },
        include: { product: true },
      });

      if (!image) {
        set.status = "Not Found";
        return { status: "error", message: "Image not found" };
      }

      if (image.product.sellerId !== user.id) {
        set.status = "Forbidden";
        return {
          status: "error",
          message: "You don't have permission to modify this product",
        };
      }

      await db.productImage.delete({
        where: { id: params.imageId },
      });

      // Reorder remaining images to maintain sequential order
      await db.productImage.updateMany({
        where: {
          productId: params.productId,
          order: { gt: image.order },
        },
        data: {
          order: { decrement: 1 },
        },
      });

      return {
        status: "success",
        message: "Image removed successfully",
      };
    } catch (error) {
      log.error("remove product image error:", error);
      set.status = 500;
      return {
        status: "error",
        message: "An error occurred while removing the image",
      };
    }
  },
  {
    params: t.Object({
      productId: t.String(),
      imageId: t.String(),
    }),
    detail: {
      tags: ["Products"],
      summary: "Remove product image",
      description: "Remove an image from a product",
    },
  },
);

import { t } from "elysia";
import { createBaseElysia } from "../../base";
import { validateSessionToken } from "../../lib/auth";
import { db } from "../../lib/db";

// Add image to product
export const addProductImage = createBaseElysia().post(
  ":id/images",
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

      const product = await db.product.findUnique({
        where: { id: params.id },
        include: { images: true },
      });

      if (!product) {
        set.status = "Not Found";
        return { status: "error", message: "Product not found" };
      }

      if (product.sellerId !== user.id) {
        set.status = "Forbidden";
        return {
          status: "error",
          message: "You don't have permission to modify this product",
        };
      }

      const newImage = await db.productImage.create({
        data: {
          url: body.url,
          productId: params.id,
          order: product.images.length, // Add to end of current images
        },
      });

      return {
        status: "success",
        message: "Image added successfully",
        data: newImage,
      };
    } catch (error) {
      log.error("add product image error:", error);
      set.status = 500;
      return {
        status: "error",
        message: "An error occurred while adding the image",
      };
    }
  },
  {
    body: t.Object({
      url: t.String(),
    }),
    params: t.Object({
      id: t.String(),
    }),
    detail: {
      tags: ["Products"],
      summary: "Add product image",
      description: "Add a new image to a product",
    },
  },
);

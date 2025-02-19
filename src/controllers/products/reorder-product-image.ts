import { t } from "elysia";
import { createBaseElysia } from "../../base";
import { validateSessionToken } from "../../lib/auth";
import { db } from "../../lib/db";

export const reorderProductImages = createBaseElysia().put(
  ":id/images/reorder",
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

      // Validate the new order
      if (body.imageOrders.length !== product.images.length) {
        set.status = "Bad Request";
        return { status: "error", message: "Invalid image order provided" };
      }

      // Update orders in transaction to maintain consistency
      await db.$transaction(
        body.imageOrders.map(({ id, order }) =>
          db.productImage.update({
            where: { id },
            data: { order },
          }),
        ),
      );

      return {
        status: "success",
        message: "Images reordered successfully",
      };
    } catch (error) {
      log.error("reorder product images error:", error);
      set.status = 500;
      return {
        status: "error",
        message: "An error occurred while reordering images",
      };
    }
  },
  {
    body: t.Object({
      imageOrders: t.Array(
        t.Object({
          id: t.String(),
          order: t.Number(),
        }),
      ),
    }),
    params: t.Object({
      id: t.String(),
    }),
    detail: {
      tags: ["Products"],
      summary: "Reorder product images",
      description: "Update the order of product images",
    },
  },
);

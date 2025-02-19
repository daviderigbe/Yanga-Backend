import { t } from "elysia";
import { createBaseElysia } from "../../base";
import { validateSessionToken } from "../../lib/auth";
import { db } from "../../lib/db";

export const deleteProduct = createBaseElysia().delete(
  ":id",
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

      if (existingProduct.sellerId !== user.id) {
        set.status = "Forbidden";
        return {
          status: "error",
          message: "You don't have permission to delete this product",
        };
      }

      // Soft delete by updating status to DELETED
      await db.product.update({
        where: { id: params.id },
        data: {
          status: "DELETED",
          isAvailable: false,
        },
      });

      return {
        status: "success",
        message: "Product successfully deleted",
      };
    } catch (error) {
      log.error("product delete error:", error);
      set.status = 500;
      return {
        status: "error",
        message: "An error occurred while deleting the product",
      };
    }
  },
  {
    params: t.Object({
      id: t.String(),
    }),
    detail: {
      tags: ["Products"],
      summary: "Delete a product",
      description:
        "Mark a product as deleted, this doesn't remove it from the database",
    },
  },
);

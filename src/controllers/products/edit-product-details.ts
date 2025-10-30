import { t } from "elysia";
import { createBaseElysia } from "../../base";
import { validateSessionToken } from "../../lib/auth";
import { db } from "../../lib/db";

export const editProductDetails = createBaseElysia().patch(
  ":id",
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

      if (existingProduct.sellerId !== user.id) {
        set.status = "Forbidden";
        return {
          status: "error",
          message: "You don't have permission to edit this product",
        };
      }

      if (
        (body.status === "ACTIVE" && body.quantity === 0) ||
        (body.isAvailable === true && body.quantity === 0)
      ) {
        set.status = "Bad Request";
        return {
          status: "error",
          message: "Cannot mark product as ACTIVE or available while quantity is 0",
        };
      }

        const updatedData: any = {
          title: body.title,
          description: body.description,
          basePrice: body.basePrice,
          discountPercent: body.discountPercent,
          status: body.status,
          condition: body.condition,
          size: body.size,
          gender: body.gender,
          color: body.color,
          brand: body.brand,
          categoryId: body.categoryId,
          isAvailable: body.isAvailable,
          quantity: body.quantity,
        };

        // 🧩 Automatic logic for quantity & availability
        if (typeof body.quantity === "number") {
          if (body.quantity === 0) {
            // Out of stock
            updatedData.isAvailable = false;
            updatedData.status = "SOLD";
          } else if (existingProduct.quantity === 0 && body.quantity > 0) {
            // Restocked — reactivate
            updatedData.isAvailable = true;
            updatedData.status = "ACTIVE";
          } else {
            updatedData.isAvailable = body.quantity > 0;
          }
        }

        const updatedProduct = await db.product.update({
          where: { id: params.id },
          data: updatedData,
        });

        return {
          status: "success",
          message: "Product updated successfully",
          data: updatedProduct,
        };

    } catch (error) {
      log.error("product update error:", error);
      set.status = 500;
      return {
        status: "error",
        message: "An error occurred while updating the product",
      };
    }
  },
  {
    params: t.Object({
      id: t.String(),
    }),
    body: t.Object({
      title: t.Optional(t.String()),
      description: t.Optional(t.String()),
      basePrice: t.Optional(t.Number()),
      discountPercent: t.Optional(t.Number()),
      status: t.Optional(
        t.Enum({
          DRAFT: "DRAFT",
          ACTIVE: "ACTIVE",
          SOLD: "SOLD",
          DELETED: "DELETED",
        }),
      ),
      condition: t.Optional(
        t.Enum({
          NEW: "NEW",
          OPEN_BOX: "OPEN_BOX",
          LIKE_NEW: "LIKE_NEW",
          LIGHTLY_USED: "LIGHTLY_USED",
          FAIRLY_USED: "FAIRLY_USED",
          HEAVILY_USED: "HEAVILY_USED",
        }),
      ),
      size: t.Optional(t.String()),
      gender: t.Optional(
        t.Enum({
          MEN: "MEN",
          WOMEN: "WOMEN",
          UNISEX: "UNISEX",
        }),
      ),
      color: t.Optional(t.String()),
      brand: t.Optional(t.String()),
      categoryId: t.Optional(t.String()),
      isAvailable: t.Optional(t.Boolean()),
      quantity: t.Optional(t.Number({ minimum: 0 })),
    }),
    detail: {
      tags: ["Products"],
      summary: "Edit product details",
      description: "Edit the details of a product",
    },
  },
);

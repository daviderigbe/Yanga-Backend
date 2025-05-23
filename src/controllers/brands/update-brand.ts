import { t } from "elysia";
import { createBaseElysia } from "../../base";
import { validateSessionToken } from "../../lib/auth";
import { db } from "../../lib/db";

export const updateBrand = createBaseElysia().put(
  "/brands/:id",
  async ({ params, body, set, log, cookie: { session } }) => {
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

      const brand = await db.brand.findFirst({
        where: {
          id: params.id,
          ownerId: user.id,
        },
      });

      if (!brand) {
        set.status = "Not Found";
        return {
          status: "error",
          message: "Brand not found or you don't have permission",
        };
      }

      if (brand.status !== "DRAFT" && brand.status !== "REJECTED") {
        set.status = "Bad Request";
        return {
          status: "error",
          message: "Only draft or rejected brands can be updated",
        };
      }

      const updatedBrand = await db.brand.update({
        where: { id: params.id },
        data: {
          name: body.name,
          description: body.description,
          contactAddress: body.contactAddress,
          businessPhoneNumber: body.businessPhoneNumber,
          logoUrl: body.logoUrl,
        },
      });

      set.status = "OK";
      return {
        status: "success",
        message: "Brand updated successfully",
        data: updatedBrand,
      };
    } catch (error) {
      log.error("Brand update error:", error);
      set.status = 500;
      return {
        status: "error",
        message: "An error occurred while updating brand",
      };
    }
  },
  {
    params: t.Object({
      id: t.String(),
    }),
    body: t.Object({
      name: t.String({ minLength: 2, maxLength: 100 }),
      description: t.Optional(t.String({ maxLength: 1000 })),
      contactAddress: t.Optional(t.String({ maxLength: 500 })),
      businessPhoneNumber: t.Optional(t.String({ maxLength: 20 })),
      logoUrl: t.Optional(t.String()),
    }),
    detail: {
      tags: ["Brands"],
      summary: "Update brand",
      description: "Update brand information (only drafts and rejected brands)",
    },
  },
);

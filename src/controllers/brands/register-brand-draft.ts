import { t } from "elysia";
import { createBaseElysia } from "../../base";
import { validateSessionToken } from "../../lib/auth";
import { db } from "../../lib/db";

// 1. Register a new brand (save as draft)
export const registerBrandDraft = createBaseElysia().post(
  "/brands/register-draft",
  async ({ body, set, log, cookie: { session } }) => {
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

      // Check if user already has a brand with this name
      const existingBrand = await db.brand.findFirst({
        where: {
          name: body.name,
          ownerId: user.id,
        },
      });

      if (existingBrand) {
        set.status = "Conflict";
        return {
          status: "error",
          message: "Brand with this name already exists",
        };
      }

      const brand = await db.brand.create({
        data: {
          name: body.name,
          description: body.description,
          contactAddress: body.contactAddress,
          businessPhoneNumber: body.businessPhoneNumber,
          logoUrl: body.logoUrl,
          ownerId: user.id,
          status: "DRAFT",
        },
      });

      set.status = "Created";
      return {
        status: "success",
        message: "Brand saved as draft",
        data: brand,
      };
    } catch (error) {
      log.error("Brand draft creation error:", error);
      set.status = 500;
      return {
        status: "error",
        message: "An error occurred while saving brand draft",
      };
    }
  },
  {
    body: t.Object({
      name: t.String({ minLength: 2, maxLength: 100 }),
      description: t.Optional(t.String({ maxLength: 1000 })),
      contactAddress: t.Optional(t.String({ maxLength: 500 })),
      businessPhoneNumber: t.Optional(t.String({ maxLength: 20 })),
      logoUrl: t.Optional(t.String()),
    }),
    detail: {
      tags: ["Brands"],
      summary: "Save brand as draft",
      description: "Save brand registration information as draft",
    },
  },
);

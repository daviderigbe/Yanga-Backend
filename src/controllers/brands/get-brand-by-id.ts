import { t } from "elysia";
import { createBaseElysia } from "../../base";
import { validateSessionToken } from "../../lib/auth";
import { db } from "../../lib/db";

export const getBrandById = createBaseElysia().get(
  "/brands/:id",
  async ({ params, set, log, cookie: { session } }) => {
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
        include: {
          certificationFiles: true,
          _count: {
            select: {
              products: true,
            },
          },
        },
      });

      if (!brand) {
        set.status = "Not Found";
        return {
          status: "error",
          message: "Brand not found or you don't have permission",
        };
      }

      set.status = "OK";
      return {
        status: "success",
        data: brand,
      };
    } catch (error) {
      log.error("Get brand error:", error);
      set.status = 500;
      return {
        status: "error",
        message: "An error occurred while fetching brand",
      };
    }
  },
  {
    params: t.Object({
      id: t.String(),
    }),
    detail: {
      tags: ["Brands"],
      summary: "Get brand by ID",
      description: "Get brand details by ID (only owner can access)",
    },
  },
);

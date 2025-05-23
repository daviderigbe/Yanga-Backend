import { t } from "elysia";
import { createBaseElysia } from "../../base";
import { validateSessionToken } from "../../lib/auth";
import { db } from "../../lib/db";

export const deleteBrand = createBaseElysia().delete(
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

      if (brand.status !== "DRAFT") {
        set.status = "Bad Request";
        return {
          status: "error",
          message: "Only draft brands can be deleted",
        };
      }

      if (brand._count.products > 0) {
        set.status = "Bad Request";
        return {
          status: "error",
          message: "Cannot delete brand with associated products",
        };
      }

      await db.brand.delete({
        where: { id: params.id },
      });

      set.status = "OK";
      return {
        status: "success",
        message: "Brand deleted successfully",
      };
    } catch (error) {
      log.error("Brand deletion error:", error);
      set.status = 500;
      return {
        status: "error",
        message: "An error occurred while deleting brand",
      };
    }
  },
  {
    params: t.Object({
      id: t.String(),
    }),
    detail: {
      tags: ["Brands"],
      summary: "Delete brand",
      description: "Delete brand (only draft brands with no products)",
    },
  },
);

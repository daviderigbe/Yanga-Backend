import { t } from "elysia";
import { createBaseElysia } from "../../base";
import { validateSessionToken } from "../../lib/auth";
import { db } from "../../lib/db";

export const getUserBrands = createBaseElysia().get(
  "/brands/my-brands",
  async ({ set, log, cookie: { session }, query }) => {
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

      const page = parseInt(query.page || "1");
      const limit = parseInt(query.limit || "10");

      const brands = await db.brand.findMany({
        where: {
          ownerId: user.id,
          ...(query.status && { status: query.status as any }),
        },
        include: {
          certificationFiles: true,
          _count: {
            select: {
              products: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      });

      const total = await db.brand.count({
        where: {
          ownerId: user.id,
          ...(query.status && { status: query.status as any }),
        },
      });

      set.status = "OK";
      return {
        status: "success",
        data: {
          brands,
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
          },
        },
      };
    } catch (error) {
      log.error("Get user brands error:", error);
      set.status = 500;
      return {
        status: "error",
        message: "An error occurred while fetching brands",
      };
    }
  },
  {
    query: t.Object({
      page: t.Optional(t.String()),
      limit: t.Optional(t.String()),
      status: t.Optional(
        t.Union([
          t.Literal("DRAFT"),
          t.Literal("PENDING"),
          t.Literal("VERIFIED"),
          t.Literal("REJECTED"),
        ]),
      ),
    }),
    detail: {
      tags: ["Brands"],
      summary: "Get user's brands",
      description: "Get all brands owned by the current user",
    },
  },
);

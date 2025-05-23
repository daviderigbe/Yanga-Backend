import { t } from "elysia";
import { createBaseElysia } from "../../base";
import { validateSessionToken } from "../../lib/auth";
import { db } from "../../lib/db";

export const getVerifiedBrands = createBaseElysia().get(
  "/brands/verified",
  async ({ set, log, query }) => {
    try {
      const page = parseInt(query.page || "1");
      const limit = parseInt(query.limit || "20");
      const search = query.search || "";

      const brands = await db.brand.findMany({
        where: {
          status: "VERIFIED",
          ...(search && {
            name: {
              contains: search,
              mode: "insensitive",
            },
          }),
        },
        select: {
          id: true,
          name: true,
          description: true,
          logoUrl: true,
          createdAt: true,
          verifiedAt: true,
          _count: {
            select: {
              products: {
                where: {
                  status: "ACTIVE",
                },
              },
            },
          },
        },
        orderBy: { verifiedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      });

      const total = await db.brand.count({
        where: {
          status: "VERIFIED",
          ...(search && {
            name: {
              contains: search,
              mode: "insensitive",
            },
          }),
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
      log.error("Get verified brands error:", error);
      set.status = 500;
      return {
        status: "error",
        message: "An error occurred while fetching verified brands",
      };
    }
  },
  {
    query: t.Object({
      page: t.Optional(t.String()),
      limit: t.Optional(t.String()),
      search: t.Optional(t.String()),
    }),
    detail: {
      tags: ["Brands"],
      summary: "Get verified brands",
      description: "Get all verified brands (public endpoint)",
    },
  },
);

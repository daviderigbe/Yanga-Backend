import { t } from "elysia";
import { createBaseElysia } from "../../base";
import { db } from "../../lib/db";

// Define the response type for better type safety
const ProductResponseSchema = t.Object({
  status: t.Enum({ success: "success", error: "error" }),
  message: t.String(),
  data: t.Optional(
    t.Object({
      items: t.Array(
        t.Object({
          id: t.String(),
          title: t.String(),
          description: t.String(),
          basePrice: t.Number(),
          discountPercent: t.Optional(t.Number()),
          status: t.Enum({
            DRAFT: "DRAFT",
            ACTIVE: "ACTIVE",
            SOLD: "SOLD",
            DELETED: "DELETED",
          }),
          condition: t.Enum({
            NEW: "NEW",
            OPEN_BOX: "OPEN_BOX",
            LIKE_NEW: "LIKE_NEW",
            LIGHTLY_USED: "LIGHTLY_USED",
            FAIRLY_USED: "FAIRLY_USED",
            HEAVILY_USED: "HEAVILY_USED",
          }),
          size: t.String(),
          gender: t.Enum({ MEN: "MEN", WOMEN: "WOMEN", UNISEX: "UNISEX" }),
          color: t.String(),
          brand: t.Optional(t.String()),
          category: t.Object({
            id: t.String(),
            name: t.String(),
          }),
          images: t.Array(
            t.Object({
              id: t.String(),
              url: t.String(),
              order: t.Number(),
            }),
          ),
          seller: t.Object({
            id: t.String(),
            name: t.String(),
          }),
          isAvailable: t.Boolean(),
          createdAt: t.String(),
          updatedAt: t.String(),
        }),
      ),
      pagination: t.Object({
        total: t.Number(),
        lastPage: t.Number(),
        currentPage: t.Number(),
        perPage: t.Number(),
        prev: t.Optional(t.Number()),
        next: t.Optional(t.Number()),
      }),
    }),
  ),
});

export const fetchProducts = createBaseElysia().get(
  "",
  async ({ set, log, query }) => {
    try {
      const {
        page = "1",
        limit = "10",
        search,
        gender,
        condition,
        categoryId,
        minPrice,
        maxPrice,
        brand,
        color,
        size,
        status = "ACTIVE",
        sortBy = "createdAt",
        sortOrder = "desc",
      } = query;

      // Convert pagination params to numbers
      const currentPage = parseInt(page);
      const perPage = parseInt(limit);
      const skip = (currentPage - 1) * perPage;

      // Define the dynamic filtering conditions
      // const whereConditions = {
      //   status,
      //   isAvailable: true,
      //   ...(search && {
      //     OR: [
      //       { title: { contains: search, mode: "insensitive" } },
      //       { description: { contains: search, mode: "insensitive" } },
      //     ],
      //   }),
      //   ...(gender && { gender }),
      //   ...(condition && { condition }),
      //   ...(categoryId && { categoryId }),
      //   ...(brand && { brand }),
      //   ...(color && { color: { contains: color, mode: "insensitive" } }),
      //   ...(size && { size }),
      //   ...(minPrice && { basePrice: { gte: parseFloat(minPrice) } }),
      //   ...(maxPrice && { basePrice: { lte: parseFloat(maxPrice) } }),
      // };

      // Fetch products with filters and pagination
      const [products, total] = await Promise.all([
        db.product.findMany({
          where: {
            status,
            isAvailable: true,
            ...(search && {
              OR: [
                { title: { contains: search, mode: "insensitive" } },
                { description: { contains: search, mode: "insensitive" } },
              ],
            }),
            ...(gender && { gender }),
            ...(condition && { condition }),
            ...(categoryId && { categoryId }),
            ...(brand && { brand }),
            ...(color && { color: { contains: color, mode: "insensitive" } }),
            ...(size && { size }),
            ...(minPrice && { basePrice: { gte: parseFloat(minPrice) } }),
            ...(maxPrice && { basePrice: { lte: parseFloat(maxPrice) } }),
          },
          skip,
          take: perPage,
          orderBy: { [sortBy]: sortOrder },
          include: {
            category: {
              select: {
                id: true,
                name: true,
              },
            },
            images: {
              orderBy: {
                order: "asc",
              },
              select: {
                id: true,
                url: true,
                order: true,
              },
            },
            seller: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        }),
        // Use the same filtering conditions for counting total products
        db.product.count({
          where: {
            status,
            isAvailable: true,
            ...(search && {
              OR: [
                { title: { contains: search, mode: "insensitive" } },
                { description: { contains: search, mode: "insensitive" } },
              ],
            }),
            ...(gender && { gender }),
            ...(condition && { condition }),
            ...(categoryId && { categoryId }),
            ...(brand && { brand }),
            ...(color && { color: { contains: color, mode: "insensitive" } }),
            ...(size && { size }),
            ...(minPrice && { basePrice: { gte: parseFloat(minPrice) } }),
            ...(maxPrice && { basePrice: { lte: parseFloat(maxPrice) } }),
          },
        }),
      ]);

      // Calculate pagination metadata
      const lastPage = Math.ceil(total / perPage);

      set.status = "OK";

      return {
        status: "success",
        message: "Products retrieved successfully",
        data: {
          items: products,
          pagination: {
            total,
            lastPage,
            currentPage,
            perPage,
            prev: currentPage > 1 ? currentPage - 1 : null,
            next: currentPage < lastPage ? currentPage + 1 : null,
          },
        },
      };
    } catch (error) {
      log.error(error);
      set.status = 500;
      return {
        status: "error",
        message: "Failed to fetch products",
      };
    }
  },
  {
    query: t.Object({
      page: t.Optional(t.String()),
      limit: t.Optional(t.String()),
      search: t.Optional(t.String()),
      gender: t.Optional(
        t.Enum({ MEN: "MEN", WOMEN: "WOMEN", UNISEX: "UNISEX" }),
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
      categoryId: t.Optional(t.String()),
      minPrice: t.Optional(t.String()),
      maxPrice: t.Optional(t.String()),
      brand: t.Optional(t.String()),
      color: t.Optional(t.String()),
      size: t.Optional(t.String()),
      status: t.Optional(
        t.Enum({
          DRAFT: "DRAFT",
          ACTIVE: "ACTIVE",
          SOLD: "SOLD",
          DELETED: "DELETED",
        }),
      ),
      sortBy: t.Optional(t.String()),
      sortOrder: t.Optional(t.Enum({ asc: "asc", desc: "desc" })),
    }),
    response: ProductResponseSchema,
    detail: {
      tags: ["Products"],
      summary: "Fetch all products",
      description:
        "Fetch all products from the database with filtering and pagination, this endpoint should be used anywhere products are to be fetched from the db without things like user specific filters",
    },
  },
);

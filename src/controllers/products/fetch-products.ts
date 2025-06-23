import { t } from "elysia";
import { createBaseElysia } from "../../base";
import { db } from "../../lib/db";
import { validateSessionToken } from "../../lib/auth";

// Updated response schema to include brand details
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
          brand: t.Optional(
            t.Object({
              id: t.String(),
              name: t.String(),
              logoUrl: t.Optional(t.String()),
            }),
          ),
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
          isNew: t.Boolean(),
          isLiked: t.Boolean(),
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
  async ({ set, log, cookie: { session }, query }) => {
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
        brandId, // Added brandId for filtering
        color,
        size,
        status = "ACTIVE",
        sortBy = "createdAt",
        sortOrder = "desc",
      } = query;

      let userId: string | undefined = undefined;
      if (session && session.value) {
        try {
          const { user } = await validateSessionToken(session.value);
          userId = user?.id;
        } catch (error) {
          // Session validation failed but we continue without user context
          log.warn("Session validation failed");
        }
      }

      // Convert pagination params to numbers
      const currentPage = parseInt(page);
      const perPage = parseInt(limit);
      const skip = (currentPage - 1) * perPage;

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
                { brand: { name: { contains: search, mode: "insensitive" } } }, // Search by brand name
              ],
            }),
            ...(gender && { gender }),
            ...(condition && { condition }),
            ...(categoryId && { categoryId }),
            ...(brandId && { brandId }), // Filter by brand ID
            ...(color && { color: { contains: color, mode: "insensitive" } }),
            ...(size && { size }),
            ...(minPrice && { basePrice: { gte: parseFloat(minPrice) } }),
            ...(maxPrice && { basePrice: { lte: parseFloat(maxPrice) } }),
          },
          skip,
          take: perPage,
          orderBy: { [sortBy]: sortOrder },
          include: {
            categories: {
              include: {
                category: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
            brand: {
              // Include brand details
              select: {
                id: true,
                name: true,
                logoUrl: true,
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
            likes: userId
              ? {
                  where: {
                    userId: userId,
                  },
                  select: {
                    id: true,
                  },
                }
              : undefined,
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
                { brand: { name: { contains: search, mode: "insensitive" } } }, // Search by brand name
              ],
            }),
            ...(gender && { gender }),
            ...(condition && { condition }),
            ...(categoryId && { categoryId }),
            ...(brandId && { brandId }), // Filter by brand ID
            ...(color && { color: { contains: color, mode: "insensitive" } }),
            ...(size && { size }),
            ...(minPrice && { basePrice: { gte: parseFloat(minPrice) } }),
            ...(maxPrice && { basePrice: { lte: parseFloat(maxPrice) } }),
          },
        }),
      ]);

      // Calculate pagination metadata
      const lastPage = Math.ceil(total / perPage);

      // Define what makes a product "new" - here using 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      set.status = "OK";

      return {
        status: "success",
        message: "Products retrieved successfully",
        data: {
          items: products.map((product) => ({
            ...product,
            // Check if product is new (posted within the last 7 days)
            isNew: new Date(product.createdAt) > sevenDaysAgo,
            // Check if the product is liked by the current user
            isLiked: userId ? product.likes && product.likes.length > 0 : false,
            // Remove the likes array from the response
            likes: undefined,
          })),
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
      brandId: t.Optional(t.String()), // Added brandId as a query parameter
      minPrice: t.Optional(t.String()),
      maxPrice: t.Optional(t.String()),
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

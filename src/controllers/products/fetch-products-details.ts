import { t } from "elysia";
import { createBaseElysia } from "../../base";
import { db } from "../../lib/db";

// Define the response type for single product
const SingleProductResponseSchema = t.Object({
  status: t.Enum({ success: "success", error: "error" }),
  message: t.String(),
  data: t.Optional(
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
      tags: t.Array(
        t.Object({
          id: t.String(),
          name: t.String(),
        }),
      ),
      reviews: t.Array(
        t.Object({
          rating: t.Number(),
          description: t.Optional(t.String()),
          user: t.Object({
            id: t.String(),
            name: t.String(),
          }),
        }),
      ),
      likesCount: t.Number(),
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
});

export const fetchProductById = createBaseElysia().get(
  "/:id",
  async ({ set, log, params }) => {
    try {
      const { id } = params;
      const product = await db.product.findUnique({
        where: {
          id: id,
        },
        include: {
          category: {
            select: {
              id: true,
              name: true,
            },
          },
          tags: {
            select: {
              tag: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          reviews: {
            select: {
              rating: true,
              description: true,
              user: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          likes: {
            select: {
              id: true,
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
      });

      if (!product) {
        set.status = 404;
        return {
          status: "error",
          message: "Product not found",
        };
      }

      // Transform the data to match the expected format
      const transformedProduct = {
        ...product,
        tags: product.tags.map(({ tag }) => tag),
        likesCount: product.likes.length,
      };

      // Remove the likes array since we've transformed it to count
      // delete transformedProduct.likes;

      set.status = "OK";
      return {
        status: "success",
        message: "Product retrieved successfully",
        data: transformedProduct,
      };
    } catch (error) {
      log.error(error);
      set.status = 500;
      return {
        status: "error",
        message: "Failed to fetch product",
      };
    }
  },
  {
    params: t.Object({
      id: t.String(),
    }),
    response: SingleProductResponseSchema,
    detail: {
      tags: ["Products"],
      summary: "Fetch product by id",
      description: "Fetch a single product by ID with all its related data",
    },
  },
);

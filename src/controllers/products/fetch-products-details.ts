import { t } from "elysia";
import { createBaseElysia } from "../../base";
import { db } from "../../lib/db";
import { validateSessionToken } from "../../lib/auth";

// Update the SingleProductResponseSchema to include isLiked field
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
      isLiked: t.Boolean(), // Add isLiked field to the schema
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
        userName: t.Optional(t.String()),
        imageUrl: t.Optional(t.String()),
        averageRating: t.Optional(t.Number()),
        totalReviews: t.Optional(t.Number()),
        bio: t.Optional(t.String()),
        followers: t.Optional(t.Number()),
      }),
      isAvailable: t.Boolean(),
      createdAt: t.String(),
      updatedAt: t.String(),
    }),
  ),
});

export const fetchProductById = createBaseElysia().get(
  "/:id",
  async ({ set, log, params, cookie: { session } }) => {
    try {
      const { id } = params;

      // Get the logged-in user's ID from the session
      let loggedInUserId: string | undefined = undefined;
      if (session && session.value) {
        try {
          const { user } = await validateSessionToken(session.value);
          loggedInUserId = user?.id;
        } catch (error) {
          // Session validation failed but we continue without user context
          log.warn("Session validation failed");
        }
      }

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
              userId: true,
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
            include: {
              products: {
                select: {
                  id: true,
                  reviews: {
                    select: {
                      rating: true,
                    },
                  },
                },
              },
              _count: {
                select: {
                  followers: true,
                  products: true,
                  reviews: true,
                },
              },
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

      // Calculate seller's average rating
      const sellerReviews = product.seller.products.flatMap((p) => p.reviews);
      const averageRating =
        sellerReviews.length > 0
          ? sellerReviews.reduce((sum, review) => sum + review.rating, 0) /
            sellerReviews.length
          : null;

      // Check if the logged-in user has liked this product
      const isLiked = loggedInUserId
        ? product.likes.some((like) => like.userId === loggedInUserId)
        : false;

      // Transform the data to match the expected format
      const transformedProduct = {
        ...product,
        tags: product.tags.map(({ tag }) => tag),
        likesCount: product.likes.length,
        isLiked, // Add the isLiked field
        seller: {
          id: product.seller.id,
          name: product.seller.name,
          userName: product.seller.userName,
          imageUrl: product.seller.imageUrl,
          bio: product.seller.bio,
          averageRating: averageRating
            ? Number(averageRating.toFixed(1))
            : null,
          totalReviews: sellerReviews.length,
          followers: product.seller._count.followers,
        },
      };

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
      description:
        "Fetch a single product by ID with all its related data, including detailed seller information and whether the logged-in user has liked it",
    },
  },
);

import { createBaseElysia } from "../../base";
import { validateSessionToken } from "../../lib/auth";
import { db } from "../../lib/db";
import { Gender, ProductStatus, Condition } from "@prisma/client";
import { t } from "elysia";

export const createProduct = createBaseElysia().post(
  "/create",
  async ({ log, set, body, cookie: { session } }) => {
    try {
      // 1. Authentication check
      if (!session.value) {
        set.status = 401;
        return {
          status: "error",
          message: "Authentication required",
        };
      }

      const { session: dbSession, user } = await validateSessionToken(
        session.value,
      );

      if (!dbSession || !user) {
        set.status = 401;
        return {
          status: "error",
          message: "Invalid session",
        };
      }

      if (user.isDeactivated) {
        set.status = 403;
        return {
          status: "error",
          message: "Account is deactivated",
        };
      }

      // 2. Extract and validate request data
      const {
        title,
        description,
        categories = [],
        size,
        gender,
        color,
        condition,
        tags = [],
        basePrice,
        discountPercent = null,
        images = [],
        status = "DRAFT",
        brand = null,
      } = body;

      // 3. Validate category exists
      const categoryObjects = await Promise.all(
        categories.map(async (name) => {
          const normalized = name.trim().toLowerCase();
          if (!normalized) return null;

          const category = await db.category.upsert({
            where: { name: normalized },
            update: {},
            create: { name: normalized },
          });

          return category.id;
        }),
      );

      // Filter out nulls (from empty or invalid strings)
      const validCategoryIds = categoryObjects.filter((id) => id !== null);

      if (validCategoryIds.length === 0) {
        set.status = 400;
        return {
          status: "error",
          message: "At least one valid category is required",
        };
      }

      // 4. Validate images array
      if (images.length === 0) {
        set.status = 400;
        return {
          status: "error",
          message: "At least one product image is required",
        };
      }

      // 5. Check for valid price
      if (basePrice <= 0) {
        set.status = 400;
        return {
          status: "error",
          message: "Base price must be greater than zero",
        };
      }

      // 6. Check valid discount percentage
      if (
        discountPercent !== null &&
        (discountPercent < 0 || discountPercent > 100)
      ) {
        set.status = 400;
        return {
          status: "error",
          message: "Discount percentage must be between 0 and 100",
        };
      }

      // 7. Process tags with efficient upsert operations
      const tagObjects = await Promise.all(
        tags.map(async (tagName) => {
          const normalizedTag = tagName.trim().toLowerCase();
          if (!normalizedTag) return null;

          // Use upsert to create or find in one operation
          const tag = await db.tag.upsert({
            where: { name: normalizedTag },
            update: {}, // No updates needed
            create: { name: normalizedTag },
          });

          return tag.id;
        }),
      );

      // Filter out any null values from empty tags
      const validTagIds = tagObjects.filter((id) => id !== null);

      // 8. Handle brand lookup if provided
      let brandId = null;
      if (brand && brand.trim()) {
        const brandRecord = await db.brand.findUnique({
          where: { name: brand.trim() },
        });
        if (brandRecord) {
          brandId = brandRecord.id;
        }
      }

      // 9. Transaction to ensure data consistency
      const product = await db.$transaction(async (tx) => {
        // Create the product with its basic information
        const newProduct = await tx.product.create({
          data: {
            title: title.trim(),
            description: description.trim(),
            sellerId: user.id,
            size: size.trim(),
            gender,
            color: color.trim(),
            condition,
            basePrice,
            discountPercent,
            status,
            brandId, // Use brandId instead of brand
            // Create the product images
            images: {
              create: images.map((url, index) => ({
                url,
                order: index,
              })),
            },
          },
          include: {
            images: {
              orderBy: {
                order: "asc",
              },
            },
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
            seller: {
              select: {
                id: true,
                name: true,
                userName: true,
                imageUrl: true,
              },
            },
            tags: {
              include: {
                tag: true,
              },
            },
            brand: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        });

        // Create category relationships
        if (validCategoryIds.length > 0) {
          await tx.categoriesOnProducts.createMany({
            data: validCategoryIds.map((categoryId) => ({
              productId: newProduct.id,
              categoryId,
            })),
          });
        }

        // Create tag relationships
        if (validTagIds.length > 0) {
          await tx.tagsOnProducts.createMany({
            data: validTagIds.map((tagId) => ({
              productId: newProduct.id,
              tagId,
            })),
          });
        }

        // Create a notification for followers if product is active
        if (status === "ACTIVE") {
          // Find all followers of this user
          const followers = await tx.follow.findMany({
            where: {
              followingId: user.id,
            },
            select: {
              followerId: true,
            },
          });

          // Create notifications for followers
          if (followers.length > 0) {
            await tx.notification.createMany({
              data: followers.map((follower) => ({
                userId: follower.followerId,
                type: "NEW_PRODUCT_FROM_FOLLOWING",
                content: `${user.name || user.userName || "A seller"} just listed a new product: "${title}"`,
              })),
            });
          }
        }

        // Fetch the complete product with all relationships
        const completeProduct = await tx.product.findUnique({
          where: { id: newProduct.id },
          include: {
            images: {
              orderBy: {
                order: "asc",
              },
            },
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
            seller: {
              select: {
                id: true,
                name: true,
                userName: true,
                imageUrl: true,
              },
            },
            tags: {
              include: {
                tag: true,
              },
            },
            brand: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        });

        return completeProduct;
      });

      // 10. Format response data
      const formattedProduct = {
        ...product,
        categories: product.categories.map(
          (categoryRelation) => categoryRelation.category,
        ),
        tags: product.tags.map((tagRelation) => tagRelation.tag),
        finalPrice: calculateFinalPrice(
          Number(product.basePrice),
          product.discountPercent,
        ),
      };

      // 11. Return appropriate response
      return {
        status: "success",
        message:
          status === "DRAFT"
            ? "Product saved as draft"
            : "Product created successfully",
        data: formattedProduct,
      };
    } catch (error) {
      // 12. Improved error handling
      log.error("Product creation error:", error);

      // Handle specific database errors
      if (error.code === "P2002") {
        set.status = 400;
        return {
          status: "error",
          message: "Duplicate entry detected",
        };
      }

      if (error.code === "P2003") {
        set.status = 400;
        return {
          status: "error",
          message: "Invalid reference ID",
        };
      }

      // Generic server error
      set.status = 500;
      return {
        status: "error",
        message: "Failed to create product. Please try again later.",
      };
    }
  },
  {
    body: t.Object({
      title: t.String({ minLength: 3, maxLength: 100 }),
      description: t.String({ minLength: 10 }),
      categories: t.Array(t.String()),
      size: t.String(),
      gender: t.Enum(Gender),
      color: t.String(),
      condition: t.Enum(Condition),
      tags: t.Array(t.String()),
      basePrice: t.Number({ minimum: 0.01 }),
      discountPercent: t.Optional(t.Number({ minimum: 0, maximum: 100 })),
      images: t.Array(t.String({ format: "uri" })),
      status: t.Optional(t.Enum(ProductStatus)),
      brand: t.Optional(t.String()),
    }),
    detail: {
      tags: ["Products"],
      summary: "Create a new product",
      description:
        "Create a new product with images, category, tags, and other details",
      responses: {
        200: {
          description: "Product created successfully",
        },
        400: {
          description: "Bad request - invalid input data",
        },
        401: {
          description: "Unauthorized - missing or invalid session",
        },
        500: {
          description: "Server error",
        },
      },
    },
  },
);

// Helper function to calculate final price after discount
function calculateFinalPrice(
  basePrice: number,
  discountPercent: number | null,
): number {
  if (discountPercent === null || discountPercent === 0) {
    return basePrice;
  }

  const discountMultiplier = 1 - discountPercent / 100;
  return Number((basePrice * discountMultiplier).toFixed(2));
}

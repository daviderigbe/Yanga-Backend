import { t } from "elysia";
import { createBaseElysia } from "../../base";
import { validateSessionToken } from "../../lib/auth";
import { db } from "../../lib/db";
import { Gender, ProductStatus, Condition } from "@prisma/client";

export const createProduct = createBaseElysia().post(
  "/create",
  async ({ log, set, body, cookie: { session } }) => {
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

      const {
        title,
        description,
        categoryId,
        size,
        gender,
        color,
        condition,
        tagIds,
        basePrice,
        discountPercent,
        images,
        status = "DRAFT",
        brand,
      } = body;

      // Create the product with its basic information
      const product = await db.product.create({
        data: {
          title,
          description,
          categoryId,
          sellerId: user.id,
          size,
          gender,
          color,
          condition,
          basePrice,
          discountPercent,
          status,
          brand,
          // Create the product images
          images: {
            create: images.map((url: string, index: number) => ({
              url,
              order: index,
            })),
          },
          // Connect the tags
          tags: {
            create: tagIds.map((tagId: string) => ({
              tag: {
                connect: {
                  id: tagId,
                },
              },
            })),
          },
        },
        include: {
          images: {
            orderBy: {
              order: "asc",
            },
          },
          category: {
            select: {
              id: true,
              name: true,
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
        },
      });

      return {
        status: "success",
        message:
          status === "DRAFT"
            ? "Product saved as draft"
            : "Product created successfully",
        data: {
          ...product,
          tags: product.tags.map((tag) => tag.tag),
        },
      };
    } catch (error) {
      log.error(error);
      set.status = 500;
      return {
        status: "error",
        message: "Failed to create product",
      };
    }
  },
  {
    body: t.Object({
      title: t.String(),
      description: t.String(),
      categoryId: t.String(),
      size: t.String(),
      gender: t.Enum(Gender),
      color: t.String(),
      condition: t.Enum(Condition),
      tagIds: t.Array(t.String()),
      basePrice: t.Number(),
      discountPercent: t.Optional(t.Number()),
      images: t.Array(t.String()),
      status: t.Optional(t.Enum(ProductStatus)),
      brand: t.Optional(t.String()),
    }),
    detail: {
      tags: ["Products"],
      summary: "Create a new product",
      description:
        "Create a new product with images, category, tags, and other details",
    },
  },
);

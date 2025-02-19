import { t } from "elysia";
import { createBaseElysia } from "../../base";
import { validateSessionToken } from "../../lib/auth";
import { db } from "../../lib/db";

export const createProductReview = createBaseElysia().post(
  ":id/reviews",
  async ({ body, set, log, cookie: { session }, params }) => {
    try {
      if (!session.value) {
        set.status = "Bad Request";
        return { status: "error", message: "Session not found" };
      }

      const { session: dbSession, user } = await validateSessionToken(
        session.value,
      );
      if (!dbSession || !user) {
        set.status = "Unauthorized";
        return { status: "error", message: "Invalid session" };
      }

      const product = await db.product.findUnique({
        where: { id: params.id },
        include: {
          seller: true,
        },
      });

      if (!product) {
        set.status = "Not Found";
        return { status: "error", message: "Product not found" };
      }

      // Check if user has purchased the product
      const hasPurchased = await db.orderItem.findFirst({
        where: {
          productId: params.id,
          order: {
            buyerId: user.id,
            status: "DELIVERED", // Only allow reviews for delivered orders
          },
        },
      });

      if (!hasPurchased) {
        set.status = "Forbidden";
        return {
          status: "error",
          message: "You can only review products you have purchased",
        };
      }

      // Check if user has already reviewed this product
      const existingReview = await db.review.findFirst({
        where: {
          userId: user.id,
          productId: params.id,
        },
      });

      if (existingReview) {
        set.status = "Bad Request";
        return {
          status: "error",
          message: "You have already reviewed this product",
        };
      }

      // Validate rating
      if (body.rating < 1 || body.rating > 5) {
        set.status = "Bad Request";
        return { status: "error", message: "Rating must be between 1 and 5" };
      }

      // Create the review
      const review = await db.review.create({
        data: {
          rating: body.rating,
          description: body.description,
          userId: user.id,
          productId: params.id,
        },
      });

      //TODO: Create notification for the seller
      /*** 
       * await db.notification.create({
        data: {
          userId: product.sellerId,
          type: "PRODUCT_SOLD",
          content: `${user.name || "Someone"} left a ${review.rating}-star review on your product "${product.title}"`,
        },
      }); 
      ***/

      return {
        status: "success",
        message: "Review created Successfull",
        data: review,
      };
    } catch (error) {
      log.error("create review error:", error);
      set.status = 500;
      return {
        status: "error",
        message: "An error occurred while creating the review",
      };
    }
  },
  {
    body: t.Object({
      rating: t.Number(),
      description: t.Optional(t.String()),
    }),
    params: t.Object({
      id: t.String(),
    }),
    detail: {
      tags: ["Products"],
      summary: "Create product review",
      description: "Add a review to a product",
    },
  },
);

import { t } from "elysia";
import { createBaseElysia } from "../../base";
import { db } from "../../lib/db";

export const fetchUserReviews = createBaseElysia().get(
  "/:id/reviews",
  async ({ set, log, params, query }) => {
    try {
      const { id } = params; // productId
      const { page = "1", limit = "10" } = query;
      const currentPage = parseInt(page);
      const perPage = parseInt(limit);
      const skip = (currentPage - 1) * perPage;

      // Check if product exists
      const product = await db.product.findUnique({
        where: { id },
        select: { id: true, title: true },
      });

      if (!product) {
        set.status = 404;
        return {
          status: "error",
          message: "Product not found",
        };
      }

      // Fetch reviews and stats
      const [reviews, total, ratingCounts] = await Promise.all([
        db.review.findMany({
          where: { productId: id },
          select: {
            id: true,
            rating: true,
            description: true,
            createdAt: true,
            user: {
              select: {
                id: true,
                name: true,
                imageUrl: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
          skip,
          take: perPage,
        }),
        db.review.count({ where: { productId: id } }),
        Promise.all(
          [1, 2, 3, 4, 5].map((rating) =>
            db.review.count({ where: { productId: id, rating } }),
          ),
        ),
      ]);

      // Handle case: no reviews yet
      if (total === 0) {
        return {
          status: "success",
          message: `No reviews for "${product.title}" yet.`,
          data: {
            items: [],
            ratingsDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
            pagination: {
              total: 0,
              lastPage: 1,
              currentPage,
              perPage,
              prev: null,
              next: null,
            },
          },
        };
      }

      // Ratings distribution and pagination
      const ratingsDistribution = {
        1: ratingCounts[0],
        2: ratingCounts[1],
        3: ratingCounts[2],
        4: ratingCounts[3],
        5: ratingCounts[4],
      };

      const lastPage = Math.ceil(total / perPage);

      return {
        status: "success",
        message: "Product reviews retrieved successfully",
        data: {
          items: reviews.map((review) => ({
            id: review.id,
            reviewerName: review.user.name,
            reviewerImageUrl: review.user.imageUrl,
            rating: review.rating,
            comment: review.description,
            createdAt: review.createdAt,
          })),
          ratingsDistribution,
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
        message: "Failed to fetch product reviews",
      };
    }
  },
  {
    query: t.Object({
      page: t.Optional(t.String()),
      limit: t.Optional(t.String()),
    }),
    params: t.Object({
      id: t.String(),
    }),
    detail: {
      tags: ["Products"],
      summary: "Fetch product reviews",
      description: "Fetch reviews for a specific product with pagination",
    },
  },
);

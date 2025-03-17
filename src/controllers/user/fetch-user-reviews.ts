import { t } from "elysia";
import { createBaseElysia } from "../../base";
import { db } from "../../lib/db";

export const fetchUserReviews = createBaseElysia().get(
  "/:id/reviews",
  async ({ set, log, params, query }) => {
    try {
      const { id } = params;
      const { page = "1", limit = "10" } = query;
      const currentPage = parseInt(page);
      const perPage = parseInt(limit);
      const skip = (currentPage - 1) * perPage;

      const [reviews, total, ratingCounts] = await Promise.all([
        db.review.findMany({
          where: {
            userId: id,
          },
          select: {
            id: true,
            rating: true,
            description: true,
            user: {
              select: {
                name: true,
              },
            },
            product: {
              select: {
                id: true,
                images: {
                  orderBy: {
                    order: "asc",
                  },
                  select: {
                    url: true,
                  },
                },
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
          skip,
          take: perPage,
        }),
        db.review.count({
          where: {
            userId: id,
          },
        }),
        // Get counts for each rating (1-5 stars)
        Promise.all(
          [1, 2, 3, 4, 5].map((rating) =>
            db.review.count({
              where: {
                userId: id,
                rating: rating,
              },
            }),
          ),
        ),
      ]);

      // Create a ratings distribution object
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
        message: "Reviews retrieved successfully",
        data: {
          items: reviews.map((review) => ({
            id: review.id,
            productImages: review.product.images.map((image) => image.url),
            reviewerName: review.user.name,
            rating: review.rating,
            reviewerComment: review.description,
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
        message: "Failed to fetch user reviews",
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
      tags: ["Users"],
      summary: "Fetch user reviews",
      description: "Fetch reviews written by a user with pagination",
    },
  },
);

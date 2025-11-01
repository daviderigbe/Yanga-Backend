import { t } from "elysia";
import { createBaseElysia } from "../../base";
import { db } from "../../lib/db";

export const fetchUserReviews = createBaseElysia().get(
  "/:id/reviews",
  async ({ set, log, params, query }) => {
    try {
      const { id } = params; // userId (sellerId)
      const { page = "1", limit = "10" } = query;
      const currentPage = parseInt(page);
      const perPage = parseInt(limit);
      const skip = (currentPage - 1) * perPage;

      // Verify user exists
      const user = await db.user.findUnique({
        where: { id },
        select: { id: true, name: true },
      });

      if (!user) {
        set.status = 404;
        return {
          status: "error",
          message: "User not found.",
        };
      }

      // Fetch all product IDs belonging to this user
      const userProducts = await db.product.findMany({
        where: { sellerId: id },
        select: { id: true },
      });

      const productIds = userProducts.map((p) => p.id);

      if (productIds.length === 0) {
        return {
          status: "success",
          message: "This user has not listed any products yet.",
          data: {
            items: [],
            averageRating: null,
            reviewsCount: 0,
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

      // Fetch reviews and total count
      const [reviews, total] = await Promise.all([
        db.review.findMany({
          where: { productId: { in: productIds } },
          select: {
            id: true,
            rating: true,
            description: true,
            createdAt: true,
            product: {
              select: {
                id: true,
                title: true,
                images: {
                  take: 1,
                  orderBy: { order: "asc" },
                  select: { url: true },
                },
              },
            },
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
        db.review.count({
          where: { productId: { in: productIds } },
        }),
      ]);

      // Calculate average rating and distribution
      const allRatings = await db.review.findMany({
        where: { productId: { in: productIds } },
        select: { rating: true },
      });

      const reviewsCount = allRatings.length;
      const averageRating =
        reviewsCount > 0
          ? Number(
              (
                allRatings.reduce((sum, r) => sum + r.rating, 0) / reviewsCount
              ).toFixed(1)
            )
          : null;

      // Ratings distribution
      const ratingsDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      for (const r of allRatings) {
        ratingsDistribution[r.rating] =
          (ratingsDistribution[r.rating] || 0) + 1;
      }

      // Handle case: user has products but no reviews
      if (total === 0) {
        return {
          status: "success",
          message: "This user’s products have not received any reviews yet.",
          data: {
            items: [],
            averageRating,
            reviewsCount,
            ratingsDistribution,
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

      // Pagination
      const lastPage = Math.ceil(total / perPage);

      return {
        status: "success",
        message: "User product reviews retrieved successfully.",
        data: {
          items: reviews.map((review) => ({
            id: review.id,
            productId: review.product.id,
            productTitle: review.product.title,
            productImage: review.product.images[0]?.url || null,
            reviewerName: review.user.name,
            reviewerImageUrl: review.user.imageUrl,
            rating: review.rating,
            comment: review.description,
            createdAt: review.createdAt,
          })),
          averageRating,
          reviewsCount,
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
        message: "Failed to fetch reviews for this user's products.",
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
      summary: "Fetch reviews for a user's products",
      description:
        "Fetch all reviews for the products owned by a seller, including average rating, total reviews count, and ratings distribution.",
    },
  }
);

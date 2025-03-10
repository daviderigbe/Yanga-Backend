// import { t } from "elysia";
import { createBaseElysia } from "../../base";
import { validateSessionToken } from "../../lib/auth";
import { db } from "../../lib/db";

export const getCart = createBaseElysia().get(
  "",
  async ({ set, log, cookie: { session } }) => {
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

      // Find or create cart
      let cart = await db.cart.findUnique({
        where: { userId: user.id },
        include: {
          items: {
            include: {
              product: {
                include: {
                  images: true,
                  seller: {
                    select: {
                      id: true,
                      name: true,
                      userName: true,
                      imageUrl: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!cart) {
        cart = await db.cart.create({
          data: {
            userId: user.id,
          },
          include: {
            items: {
              include: {
                product: {
                  include: {
                    images: true,
                    seller: {
                      select: {
                        id: true,
                        name: true,
                        userName: true,
                        imageUrl: true,
                      },
                    },
                  },
                },
              },
            },
          },
        });
      }

      return {
        status: "success",
        data: cart,
      };
    } catch (error) {
      log.error("get cart error:", error);
      set.status = 500;
      return {
        status: "error",
        message: "An error occurred while fetching the cart",
      };
    }
  },
  {
    detail: {
      tags: ["Cart"],
      summary: "Get user's cart",
      description: "Retrieve the current user's shopping cart with all items",
    },
  },
);

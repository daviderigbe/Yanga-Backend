import { t } from "elysia";
import { createBaseElysia } from "../../base";
import { validateSessionToken } from "../../lib/auth";
import { db } from "../../lib/db";

export const savedCards = createBaseElysia()
  .post(
    "/cards",
    async ({ body, set, log, cookie: { session } }) => {
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

        // Extract last 4 digits from card number
        const last4 = body.cardNumber.slice(-4);

        // Check if card already exists
        const existingCard = await db.savedCard.findFirst({
          where: {
            userId: user.id,
            last4: last4,
            brand: body.brand.toUpperCase(),
          },
        });

        if (existingCard) {
          set.status = "Bad Request";
          return {
            status: "error",
            message: "This card is already saved",
          };
        }

        // If this is being set as default, update existing defaults
        if (body.isDefault) {
          await db.savedCard.updateMany({
            where: {
              userId: user.id,
            },
            data: {
              isDefault: false,
            },
          });
        }

        // Create new saved card (never store full card number)
        const newCard = await db.savedCard.create({
          data: {
            userId: user.id,
            last4: last4,
            brand: body.brand.toUpperCase(),
            expiryMonth: body.expiryMonth,
            expiryYear: body.expiryYear,
            isDefault: body.isDefault || false,
          },
        });

        set.status = "Created";
        return {
          status: "success",
          message: "Card saved successfully",
          data: {
            id: newCard.id,
            last4: newCard.last4,
            brand: newCard.brand,
            expiryMonth: newCard.expiryMonth,
            expiryYear: newCard.expiryYear,
            isDefault: newCard.isDefault,
          },
        };
      } catch (error) {
        log.error("Save card error:", error);
        set.status = 500;
        return {
          status: "error",
          message: "An error occurred while saving the card",
        };
      }
    },
    {
      body: t.Object({
        cardNumber: t.String({
          minLength: 13,
          maxLength: 19,
          pattern: "^[0-9]+$",
          error: "Card number must be 13-19 digits",
        }),
        brand: t.Union(
          [
            t.Literal("VISA"),
            t.Literal("MASTERCARD"),
            t.Literal("AMEX"),
            t.Literal("DISCOVER"),
            t.Literal("VERVE"),
          ],
          {
            error:
              "Brand must be one of: VISA, MASTERCARD, AMEX, DISCOVER, VERVE",
          },
        ),
        expiryMonth: t.Number({
          minimum: 1,
          maximum: 12,
          error: "Expiry month must be between 1 and 12",
        }),
        expiryYear: t.Number({
          minimum: new Date().getFullYear(),
          maximum: new Date().getFullYear() + 20,
          error: "Expiry year must be current year or future",
        }),
        isDefault: t.Optional(t.Boolean()),
      }),
      detail: {
        tags: ["Payment"],
        summary: "Save card",
        description: "Save a new payment card (only last 4 digits stored)",
      },
    },
  )
  .get(
    "/cards",
    async ({ set, log, cookie: { session } }) => {
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

        const savedCards = await db.savedCard.findMany({
          where: {
            userId: user.id,
          },
          select: {
            id: true,
            last4: true,
            brand: true,
            expiryMonth: true,
            expiryYear: true,
            isDefault: true,
          },
          orderBy: [{ isDefault: "desc" }],
        });

        set.status = "OK";
        return {
          status: "success",
          message: "Saved cards retrieved successfully",
          data: savedCards,
        };
      } catch (error) {
        log.error("Get saved cards error:", error);
        set.status = 500;
        return {
          status: "error",
          message: "An error occurred while retrieving saved cards",
        };
      }
    },
    {
      detail: {
        tags: ["Payment"],
        summary: "Get saved cards",
        description: "Get user's saved payment cards",
      },
    },
  )
  .patch(
    "/cards/:id/default",
    async ({ params, set, log, cookie: { session } }) => {
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

        // Verify card belongs to user
        const existingCard = await db.savedCard.findFirst({
          where: {
            id: params.id,
            userId: user.id,
          },
        });

        if (!existingCard) {
          set.status = "Not Found";
          return {
            status: "error",
            message: "Card not found",
          };
        }

        // Update all cards to not be default
        await db.savedCard.updateMany({
          where: {
            userId: user.id,
          },
          data: {
            isDefault: false,
          },
        });

        // Set this card as default
        const updatedCard = await db.savedCard.update({
          where: { id: params.id },
          data: {
            isDefault: true,
          },
          select: {
            id: true,
            last4: true,
            brand: true,
            expiryMonth: true,
            expiryYear: true,
            isDefault: true,
          },
        });

        set.status = "OK";
        return {
          status: "success",
          message: "Default card updated successfully",
          data: updatedCard,
        };
      } catch (error) {
        log.error("Update default card error:", error);
        set.status = 500;
        return {
          status: "error",
          message: "An error occurred while updating default card",
        };
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      detail: {
        tags: ["Payment"],
        summary: "Set default card",
        description: "Set a saved card as the default payment method",
      },
    },
  )
  .delete(
    "/cards/:id",
    async ({ params, set, log, cookie: { session } }) => {
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

        // Verify card belongs to user
        const existingCard = await db.savedCard.findFirst({
          where: {
            id: params.id,
            userId: user.id,
          },
        });

        if (!existingCard) {
          set.status = "Not Found";
          return {
            status: "error",
            message: "Card not found",
          };
        }

        // Delete card
        await db.savedCard.delete({
          where: { id: params.id },
        });

        set.status = "OK";
        return {
          status: "success",
          message: "Card deleted successfully",
        };
      } catch (error) {
        log.error("Delete card error:", error);
        set.status = 500;
        return {
          status: "error",
          message: "An error occurred while deleting the card",
        };
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      detail: {
        tags: ["Payment"],
        summary: "Delete card",
        description: "Delete a saved payment card",
      },
    },
  );

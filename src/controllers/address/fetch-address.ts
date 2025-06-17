import { t } from "elysia";
import { createBaseElysia } from "../../base";
import { validateSessionToken } from "../../lib/auth";
import { db } from "../../lib/db";

export const addresses = createBaseElysia()
  .post(
    "",
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

        // If this is being set as default, update existing defaults
        if (body.isDefault) {
          await db.address.updateMany({
            where: {
              userId: user.id,
              type: body.type,
            },
            data: {
              isDefault: false,
            },
          });
        }

        // Create new address
        const newAddress = await db.address.create({
          data: {
            userId: user.id,
            type: body.type,
            street: body.address,
            city: body.city,
            state: body.state,
            country: body.country || "Nigeria", // Default to Nigeria
            zipCode: body.zipCode || "",
            isDefault: body.isDefault || false,
          },
        });

        set.status = "Created";
        return {
          status: "success",
          message: "Address added successfully",
          data: newAddress,
        };
      } catch (error) {
        log.error("Add address error:", error);
        set.status = 500;
        return {
          status: "error",
          message: "An error occurred while adding the address",
        };
      }
    },
    {
      body: t.Object({
        type: t.Union([t.Literal("BILLING"), t.Literal("SHIPPING")], {
          error: "Type must be either BILLING or SHIPPING",
        }),
        address: t.String({
          minLength: 5,
          maxLength: 200,
          error: "Address must be between 5 and 200 characters",
        }),
        city: t.String({
          minLength: 2,
          maxLength: 50,
          error: "City must be between 2 and 50 characters",
        }),
        state: t.String({
          minLength: 2,
          maxLength: 50,
          error: "State must be between 2 and 50 characters",
        }),
        country: t.Optional(
          t.String({
            minLength: 2,
            maxLength: 50,
          }),
        ),
        zipCode: t.Optional(
          t.String({
            maxLength: 10,
          }),
        ),
        isDefault: t.Optional(t.Boolean()),
      }),
      detail: {
        tags: ["Address"],
        summary: "Add address",
        description: "Add a new billing or shipping address",
      },
    },
  )
  .get(
    "",
    async ({ query, set, log, cookie: { session } }) => {
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

        const addresses = await db.address.findMany({
          where: {
            userId: user.id,
            ...(query.type && { type: query.type }),
          },
          orderBy: [{ isDefault: "desc" }],
        });

        set.status = "OK";
        return {
          status: "success",
          message: "Addresses retrieved successfully",
          data: addresses,
        };
      } catch (error) {
        log.error("Get addresses error:", error);
        set.status = 500;
        return {
          status: "error",
          message: "An error occurred while retrieving addresses",
        };
      }
    },
    {
      query: t.Optional(
        t.Object({
          type: t.Optional(
            t.Union([t.Literal("BILLING"), t.Literal("SHIPPING")]),
          ),
        }),
      ),
      detail: {
        tags: ["Address"],
        summary: "Get addresses",
        description: "Get user's addresses, optionally filtered by type",
      },
    },
  )
  .patch(
    "/:id",
    async ({ params, body, set, log, cookie: { session } }) => {
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

        // Verify address belongs to user
        const existingAddress = await db.address.findFirst({
          where: {
            id: params.id,
            userId: user.id,
          },
        });

        if (!existingAddress) {
          set.status = "Not Found";
          return {
            status: "error",
            message: "Address not found",
          };
        }

        // If this is being set as default, update existing defaults
        if (body.isDefault) {
          await db.address.updateMany({
            where: {
              userId: user.id,
              type: existingAddress.type,
            },
            data: {
              isDefault: false,
            },
          });
        }

        // Update address
        const updatedAddress = await db.address.update({
          where: { id: params.id },
          data: {
            ...(body.address && { street: body.address }),
            ...(body.city && { city: body.city }),
            ...(body.state && { state: body.state }),
            ...(body.country && { country: body.country }),
            ...(body.zipCode && { zipCode: body.zipCode }),
            ...(body.isDefault !== undefined && { isDefault: body.isDefault }),
          },
        });

        set.status = "OK";
        return {
          status: "success",
          message: "Address updated successfully",
          data: updatedAddress,
        };
      } catch (error) {
        log.error("Update address error:", error);
        set.status = 500;
        return {
          status: "error",
          message: "An error occurred while updating the address",
        };
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      body: t.Object({
        address: t.Optional(
          t.String({
            minLength: 5,
            maxLength: 200,
          }),
        ),
        city: t.Optional(
          t.String({
            minLength: 2,
            maxLength: 50,
          }),
        ),
        state: t.Optional(
          t.String({
            minLength: 2,
            maxLength: 50,
          }),
        ),
        country: t.Optional(
          t.String({
            minLength: 2,
            maxLength: 50,
          }),
        ),
        zipCode: t.Optional(
          t.String({
            maxLength: 10,
          }),
        ),
        isDefault: t.Optional(t.Boolean()),
      }),
      detail: {
        tags: ["Address"],
        summary: "Update address",
        description: "Update an existing address",
      },
    },
  )
  .delete(
    "/:id",
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

        // Verify address belongs to user
        const existingAddress = await db.address.findFirst({
          where: {
            id: params.id,
            userId: user.id,
          },
        });

        if (!existingAddress) {
          set.status = "Not Found";
          return {
            status: "error",
            message: "Address not found",
          };
        }

        // Delete address
        await db.address.delete({
          where: { id: params.id },
        });

        set.status = "OK";
        return {
          status: "success",
          message: "Address deleted successfully",
        };
      } catch (error) {
        log.error("Delete address error:", error);
        set.status = 500;
        return {
          status: "error",
          message: "An error occurred while deleting the address",
        };
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      detail: {
        tags: ["Address"],
        summary: "Delete address",
        description: "Delete an existing address",
      },
    },
  );

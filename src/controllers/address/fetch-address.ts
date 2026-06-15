import { t } from "elysia";
import { createBaseElysia } from "../../base";
import { validateSessionToken } from "../../lib/auth";
import { db } from "../../lib/db";

// Nigerian states
const NIGERIAN_STATES = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue",
  "Borno", "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu",
  "FCT - Abuja", "Gombe", "Imo", "Jigawa", "Kaduna", "Kano", "Katsina",
  "Kebbi", "Kogi", "Kwara", "Lagos", "Nasarawa", "Niger", "Ogun",
  "Ondo", "Osun", "Oyo", "Plateau", "Rivers", "Sokoto", "Taraba",
  "Yobe", "Zamfara"
];


// Allowed countries (for now only Nigeria)
const ALLOWED_COUNTRIES = ["Nigeria"];

export const addresses = createBaseElysia()
  .post(
    "",
    async ({ body, set, log, cookie: { session } }) => {
      try {
        if (!session.value) {
          set.status = "Bad Request";
          return { status: "error", message: "Session not found" };
        }

        const { session: dbSession, user } = await validateSessionToken(session.value);

        if (!dbSession || !user) {
          set.status = "Unauthorized";
          return { status: "error", message: "Invalid session" };
        }

        // If this is being set as default, update existing defaults
        if (body.isDefault) {
          await db.address.updateMany({
            where: { userId: user.id, type: body.type },
            data: { isDefault: false },
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
            country: body.country || "Nigeria", // Only "Nigeria"
            zipCode: body.zipCode || "",
            contactName: body.contactName,
            contactPhone: body.contactPhone,
            landmark: body.landmark,
            deliveryInstructions: body.deliveryInstructions,
            latitude: body.latitude,
            longitude: body.longitude,
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
        return { status: "error", message: "An error occurred while adding the address" };
      }
    },
    {
      body: t.Object({
        type: t.Union([t.Literal("BILLING"), t.Literal("SHIPPING"), t.Literal("PICKUP")], {
          error: "Type must be BILLING, SHIPPING, or PICKUP",
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
        state: t.Union(NIGERIAN_STATES.map((s) => t.Literal(s)), {
          error: "Invalid state. Must be a valid Nigerian state",
        }),
        country: t.Optional(
          t.Union(ALLOWED_COUNTRIES.map((c) => t.Literal(c)), {
            error: "Invalid country. Only Nigeria is supported",
          }),
        ),
        zipCode: t.Optional(
          t.String({ maxLength: 10 })
        ),
        contactName: t.Optional(t.String({ minLength: 2, maxLength: 80 })),
        contactPhone: t.Optional(t.String({ minLength: 7, maxLength: 20 })),
        landmark: t.Optional(t.String({ maxLength: 120 })),
        deliveryInstructions: t.Optional(t.String({ maxLength: 250 })),
        latitude: t.Optional(t.Number({ minimum: -90, maximum: 90 })),
        longitude: t.Optional(t.Number({ minimum: -180, maximum: 180 })),
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
          return { status: "error", message: "Session not found" };
        }

        const { session: dbSession, user } = await validateSessionToken(session.value);

        if (!dbSession || !user) {
          set.status = "Unauthorized";
          return { status: "error", message: "Invalid session" };
        }

        const addresses = await db.address.findMany({
          where: { userId: user.id, ...(query.type && { type: query.type }) },
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
        return { status: "error", message: "An error occurred while retrieving addresses" };
      }
    },
    {
      query: t.Optional(
        t.Object({
          type: t.Optional(
            t.Union([t.Literal("BILLING"), t.Literal("SHIPPING"), t.Literal("PICKUP")]),
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
          return { status: "error", message: "Session not found" };
        }

        const { session: dbSession, user } = await validateSessionToken(session.value);

        if (!dbSession || !user) {
          set.status = "Unauthorized";
          return { status: "error", message: "Invalid session" };
        }

        // Verify address belongs to user
        const existingAddress = await db.address.findFirst({
          where: { id: params.id, userId: user.id },
        });

        if (!existingAddress) {
          set.status = "Not Found";
          return { status: "error", message: "Address not found" };
        }

        // If this is being set as default, update existing defaults
        if (body.isDefault) {
          await db.address.updateMany({
            where: { userId: user.id, type: existingAddress.type },
            data: { isDefault: false },
          });
        }

        // Update address
        const updatedAddress = await db.address.update({
          where: { id: params.id },
          data: {
            ...(body.address ? { street: body.address } : {}),
            ...(body.city ? { city: body.city } : {}),
            ...(body.state ? { state: body.state } : {}),
            ...(body.country ? { country: body.country } : {}),
            ...(body.zipCode ? { zipCode: body.zipCode } : {}),
            ...(body.contactName ? { contactName: body.contactName } : {}),
            ...(body.contactPhone ? { contactPhone: body.contactPhone } : {}),
            ...(body.landmark ? { landmark: body.landmark } : {}),
            ...(body.deliveryInstructions ? { deliveryInstructions: body.deliveryInstructions } : {}),
            ...(body.latitude !== undefined ? { latitude: body.latitude } : {}),
            ...(body.longitude !== undefined ? { longitude: body.longitude } : {}),
            ...(body.isDefault !== undefined ? { isDefault: body.isDefault } : {}),
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
        return { status: "error", message: "An error occurred while updating the address" };
      }
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        address: t.Optional(t.String({ minLength: 5, maxLength: 200 })),
        city: t.Optional(t.String({ minLength: 2, maxLength: 50 })),
        state: t.Optional(
          t.Union(NIGERIAN_STATES.map((s) => t.Literal(s)), {
            error: "Invalid state. Must be a valid Nigerian state",
          }),
        ),
        country: t.Optional(
          t.Union(ALLOWED_COUNTRIES.map((c) => t.Literal(c)), {
            error: "Invalid country. Only Nigeria is supported",
          }),
        ),
        zipCode: t.Optional(t.String({ maxLength: 10 })),
        contactName: t.Optional(t.String({ minLength: 2, maxLength: 80 })),
        contactPhone: t.Optional(t.String({ minLength: 7, maxLength: 20 })),
        landmark: t.Optional(t.String({ maxLength: 120 })),
        deliveryInstructions: t.Optional(t.String({ maxLength: 250 })),
        latitude: t.Optional(t.Number({ minimum: -90, maximum: 90 })),
        longitude: t.Optional(t.Number({ minimum: -180, maximum: 180 })),
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
          return { status: "error", message: "Session not found" };
        }

        const { session: dbSession, user } = await validateSessionToken(session.value);

        if (!dbSession || !user) {
          set.status = "Unauthorized";
          return { status: "error", message: "Invalid session" };
        }

        // Verify address belongs to user
        const existingAddress = await db.address.findFirst({
          where: { id: params.id, userId: user.id },
        });

        if (!existingAddress) {
          set.status = "Not Found";
          return { status: "error", message: "Address not found" };
        }

        await db.address.delete({ where: { id: params.id } });

        set.status = "OK";
        return { status: "success", message: "Address deleted successfully" };
      } catch (error) {
        log.error("Delete address error:", error);
        set.status = 500;
        return { status: "error", message: "An error occurred while deleting the address" };
      }
    },
    {
      params: t.Object({ id: t.String() }),
      detail: {
        tags: ["Address"],
        summary: "Delete address",
        description: "Delete an existing address",
      },
    },
  )
    .get(
      "/states",
      () => {
        return {
          status: "success",
          data: NIGERIAN_STATES,
        };
      },
      {
        detail: {
          tags: ["Address"],
          summary: "Get Nigerian states",
          description: "Retrieve the list of all states in Nigeria for dropdowns",
        },
      },
    );

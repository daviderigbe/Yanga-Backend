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

        const normalizedInput = {
          street: normalizeText(body.address),
          city: normalizeText(body.city),
          state: normalizeText(body.state),
          country: normalizeText(body.country || "Nigeria"),
          zipCode: normalizeText(body.zipCode || ""),
          landmark: normalizeText(body.landmark || ""),
        };

        const existingAddresses = await db.address.findMany({
          where: { userId: user.id, type: body.type },
        });
        const duplicateAddress = existingAddresses.find((address) =>
          isSameAddressLocation(normalizedInput, {
            street: address.street,
            city: address.city,
            state: address.state,
            country: address.country,
            zipCode: address.zipCode,
            landmark: address.landmark || "",
          }),
        );

        if (duplicateAddress) {
          set.status = 409;
          return {
            status: "error",
            message: "This address already exists",
            data: duplicateAddress,
          };
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
            street: normalizedInput.street,
            city: normalizedInput.city,
            state: normalizedInput.state,
            country: normalizedInput.country,
            zipCode: normalizedInput.zipCode,
            contactName: body.contactName ? normalizeText(body.contactName) : undefined,
            contactPhone: body.contactPhone ? normalizeText(body.contactPhone) : undefined,
            landmark: normalizedInput.landmark || undefined,
            deliveryInstructions: body.deliveryInstructions ? normalizeText(body.deliveryInstructions) : undefined,
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

        const nextAddressLocation = {
          street: body.address ? normalizeText(body.address) : existingAddress.street,
          city: body.city ? normalizeText(body.city) : existingAddress.city,
          state: body.state ? normalizeText(body.state) : existingAddress.state,
          country: body.country ? normalizeText(body.country) : existingAddress.country,
          zipCode: body.zipCode ? normalizeText(body.zipCode) : existingAddress.zipCode,
          landmark: body.landmark ? normalizeText(body.landmark) : existingAddress.landmark || "",
        };
        const siblingAddresses = await db.address.findMany({
          where: { userId: user.id, type: existingAddress.type, id: { not: existingAddress.id } },
        });
        const duplicateAddress = siblingAddresses.find((address) =>
          isSameAddressLocation(nextAddressLocation, {
            street: address.street,
            city: address.city,
            state: address.state,
            country: address.country,
            zipCode: address.zipCode,
            landmark: address.landmark || "",
          }),
        );

        if (duplicateAddress) {
          set.status = 409;
          return {
            status: "error",
            message: "This address already exists",
            data: duplicateAddress,
          };
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
            ...(body.address ? { street: normalizeText(body.address) } : {}),
            ...(body.city ? { city: normalizeText(body.city) } : {}),
            ...(body.state ? { state: normalizeText(body.state) } : {}),
            ...(body.country ? { country: normalizeText(body.country) } : {}),
            ...(body.zipCode ? { zipCode: normalizeText(body.zipCode) } : {}),
            ...(body.contactName ? { contactName: normalizeText(body.contactName) } : {}),
            ...(body.contactPhone ? { contactPhone: normalizeText(body.contactPhone) } : {}),
            ...(body.landmark ? { landmark: normalizeText(body.landmark) } : {}),
            ...(body.deliveryInstructions ? { deliveryInstructions: normalizeText(body.deliveryInstructions) } : {}),
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

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeAddressPart(value: string) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isSameAddressLocation(
  first: { street: string; city: string; state: string; country: string; zipCode: string; landmark: string },
  second: { street: string; city: string; state: string; country: string; zipCode: string; landmark: string },
) {
  return (
    normalizeAddressPart(first.street) === normalizeAddressPart(second.street) &&
    normalizeAddressPart(first.city) === normalizeAddressPart(second.city) &&
    normalizeAddressPart(first.state) === normalizeAddressPart(second.state) &&
    normalizeAddressPart(first.country) === normalizeAddressPart(second.country) &&
    normalizeAddressPart(first.zipCode) === normalizeAddressPart(second.zipCode) &&
    normalizeAddressPart(first.landmark) === normalizeAddressPart(second.landmark)
  );
}

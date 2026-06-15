import { t } from "elysia";
import { createBaseElysia } from "../../base";
import { validateSessionToken } from "../../lib/auth";
import { db } from "../../lib/db";
import {
  cancelDispatchShipment,
  createDispatchShipment,
  getDispatchQuote,
  mapProviderStatus,
  syncDispatchShipmentStatus,
  updateShipmentStatus,
} from "../../services/dispatch";
import { config } from "../../utils/config";

const appSwagger = {
  detail: {
    tags: ["Dispatch"],
  },
};

const DeliveryStatusSchema = t.Union([
  t.Literal("PENDING"),
  t.Literal("QUOTED"),
  t.Literal("READY_FOR_PICKUP"),
  t.Literal("DISPATCH_REQUESTED"),
  t.Literal("DISPATCHED"),
  t.Literal("IN_TRANSIT"),
  t.Literal("ARRIVED"),
  t.Literal("DELIVERED"),
  t.Literal("CANCELLED"),
  t.Literal("FAILED"),
  t.Literal("RETURNED"),
]);

const ServiceLevelSchema = t.Union([
  t.Literal("STANDARD"),
  t.Literal("EXPRESS"),
  t.Literal("SCHEDULED"),
]);

export const dispatchRoutes = createBaseElysia({
  prefix: "/dispatch",
  detail: appSwagger.detail,
})
  .post(
    "/quote",
    async ({ body, set, cookie: { session } }) => {
      const user = await getAuthenticatedUser(session.value);

      if (!user) {
        set.status = "Unauthorized";
        return { status: "error", message: "Invalid session" };
      }

      const address = await db.address.findFirst({
        where: { id: body.addressId, userId: user.id },
      });

      if (!address) {
        set.status = 404;
        return { status: "error", message: "Address not found" };
      }

      try {
        const quote = await getDispatchQuote({
          address,
          itemCount: body.itemCount,
          serviceLevel: body.serviceLevel,
        });

        return { status: "success", data: quote };
      } catch (error: any) {
        set.status = 400;
        return { status: "error", message: error.message };
      }
    },
    {
      body: t.Object({
        addressId: t.String(),
        itemCount: t.Number({ minimum: 1 }),
        serviceLevel: t.Optional(ServiceLevelSchema),
      }),
      detail: {
        tags: ["Dispatch"],
        summary: "Get delivery quote",
        description: "Returns a Lagos delivery quote for a saved customer address.",
      },
    },
  )
  .post(
    "/orders/:orderId/create",
    async ({ params, set, cookie: { session } }) => {
      const user = await getAuthenticatedUser(session.value);

      if (!user) {
        set.status = "Unauthorized";
        return { status: "error", message: "Invalid session" };
      }

      const allowed = await canAccessOrder(params.orderId, user.id);
      if (!allowed) {
        set.status = 404;
        return { status: "error", message: "Order not found" };
      }

      try {
        const shipment = await createDispatchShipment({ orderId: params.orderId });
        return { status: "success", message: "Dispatch shipment prepared", data: shipment };
      } catch (error: any) {
        set.status = 400;
        return { status: "error", message: error.message };
      }
    },
    {
      params: t.Object({ orderId: t.String() }),
      detail: {
        tags: ["Dispatch"],
        summary: "Create dispatch shipment",
        description: "Creates or retries provider dispatch for a paid order.",
      },
    },
  )
  .post(
    "/orders/:orderId/sync",
    async ({ params, set, cookie: { session } }) => {
      const user = await getAuthenticatedUser(session.value);

      if (!user) {
        set.status = "Unauthorized";
        return { status: "error", message: "Invalid session" };
      }

      const allowed = await canAccessOrder(params.orderId, user.id);
      if (!allowed) {
        set.status = 404;
        return { status: "error", message: "Order not found" };
      }

      try {
        const shipment = await syncDispatchShipmentStatus(params.orderId);
        return { status: "success", message: "Kwik shipment status synced", data: shipment };
      } catch (error: any) {
        set.status = 400;
        return { status: "error", message: error.message };
      }
    },
    {
      params: t.Object({ orderId: t.String() }),
      detail: {
        tags: ["Dispatch"],
        summary: "Sync Kwik shipment status",
        description: "Fetches the current Kwik delivery task status and updates the order shipment.",
      },
    },
  )
  .post(
    "/orders/:orderId/cancel",
    async ({ params, set, cookie: { session } }) => {
      const user = await getAuthenticatedUser(session.value);

      if (!user) {
        set.status = "Unauthorized";
        return { status: "error", message: "Invalid session" };
      }

      const allowed = await canAccessOrder(params.orderId, user.id);
      if (!allowed) {
        set.status = 404;
        return { status: "error", message: "Order not found" };
      }

      try {
        const shipment = await cancelDispatchShipment(params.orderId);
        return { status: "success", message: "Dispatch shipment cancelled", data: shipment };
      } catch (error: any) {
        set.status = 400;
        return { status: "error", message: error.message };
      }
    },
    {
      params: t.Object({ orderId: t.String() }),
      detail: {
        tags: ["Dispatch"],
        summary: "Cancel dispatch shipment",
        description: "Cancels a Kwik delivery task or a manual shipment.",
      },
    },
  )
  .get(
    "/orders/:orderId/shipment",
    async ({ params, set, cookie: { session } }) => {
      const user = await getAuthenticatedUser(session.value);

      if (!user) {
        set.status = "Unauthorized";
        return { status: "error", message: "Invalid session" };
      }

      const allowed = await canAccessOrder(params.orderId, user.id);
      if (!allowed) {
        set.status = 404;
        return { status: "error", message: "Order not found" };
      }

      const shipment = await db.shipment.findUnique({
        where: { orderId: params.orderId },
        include: { events: { orderBy: { createdAt: "desc" } } },
      });

      if (!shipment) {
        set.status = 404;
        return { status: "error", message: "Shipment not found" };
      }

      return { status: "success", data: shipment };
    },
    {
      params: t.Object({ orderId: t.String() }),
      detail: {
        tags: ["Dispatch"],
        summary: "Get order shipment",
        description: "Returns shipment details and status events for an order.",
      },
    },
  )
  .patch(
    "/shipments/:shipmentId/status",
    async ({ params, body, set, cookie: { session } }) => {
      const user = await getAuthenticatedUser(session.value);

      if (!user) {
        set.status = "Unauthorized";
        return { status: "error", message: "Invalid session" };
      }

      const shipment = await db.shipment.findUnique({
        where: { id: params.shipmentId },
        include: {
          order: {
            include: {
              items: {
                include: { product: true },
              },
            },
          },
        },
      });

      if (!shipment || !isOrderParticipant(shipment.order, user.id)) {
        set.status = 404;
        return { status: "error", message: "Shipment not found" };
      }

      if (shipment.provider !== "MANUAL") {
        set.status = 400;
        return {
          status: "error",
          message: "Kwik shipment statuses must be updated through sync or provider webhook",
        };
      }

      if (body.status === "DELIVERED" && shipment.order.buyerId !== user.id) {
        set.status = 403;
        return {
          status: "error",
          message: "Only the buyer can confirm delivery for a manual shipment",
        };
      }

      const updatedShipment = await updateShipmentStatus(params.shipmentId, body.status, {
        message: body.message,
        providerStatus: "manual",
      });

      return {
        status: "success",
        message: "Shipment status updated",
        data: updatedShipment,
      };
    },
    {
      params: t.Object({ shipmentId: t.String() }),
      body: t.Object({
        status: DeliveryStatusSchema,
        message: t.Optional(t.String()),
      }),
      detail: {
        tags: ["Dispatch"],
        summary: "Update shipment status",
        description: "Updates a manual shipment status and records a shipment event.",
      },
    },
  )
  .post(
    "/webhooks/kwik",
    async ({ body, headers, set }) => {
      if (config.KWIK_WEBHOOK_SECRET) {
        const secret = headers["x-webhook-secret"] || headers["x-kwik-webhook-secret"];
        if (secret !== config.KWIK_WEBHOOK_SECRET) {
          set.status = "Unauthorized";
          return { status: "error", message: "Invalid webhook secret" };
        }
      }

      const payload = body as any;
      const externalShipmentId = String(
        payload?.task_id ||
        payload?.job_id ||
        payload?.id ||
        payload?.data?.task_id ||
        payload?.data?.job_id ||
        payload?.data?.id ||
        "",
      );
      const externalTrackingId = String(
        payload?.tracking_id ||
        payload?.tracking_number ||
        payload?.data?.tracking_id ||
        payload?.data?.tracking_number ||
        "",
      );

      if (!externalShipmentId && !externalTrackingId) {
        set.status = 400;
        return { status: "error", message: "Webhook payload has no shipment or tracking id" };
      }

      const shipment = await db.shipment.findFirst({
        where: {
          OR: [
            ...(externalShipmentId ? [{ externalShipmentId }] : []),
            ...(externalTrackingId ? [{ externalTrackingId }] : []),
          ],
        },
      });

      if (!shipment) {
        set.status = 404;
        return { status: "error", message: "Shipment not found" };
      }

      const providerStatus = payload?.status || payload?.data?.status || payload?.job_status || payload?.data?.job_status;
      const status = mapProviderStatus(providerStatus);
      const updatedShipment = await updateShipmentStatus(shipment.id, status, {
        providerStatus: String(providerStatus || ""),
        message: payload?.message || payload?.data?.message || "Kwik webhook received",
        providerPayload: payload,
      });

      return { status: "success", data: updatedShipment };
    },
    {
      body: t.Any(),
      detail: {
        tags: ["Dispatch"],
        summary: "Kwik dispatch webhook",
        description: "Receives Kwik delivery status updates and syncs shipment/order status.",
      },
    },
  );

async function getAuthenticatedUser(token?: string) {
  if (!token) {
    return null;
  }

  const { session, user } = await validateSessionToken(token);
  return session && user ? user : null;
}

async function canAccessOrder(orderId: string, userId: string) {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        include: { product: true },
      },
    },
  });

  return Boolean(order && isOrderParticipant(order, userId));
}

function isOrderParticipant(order: any, userId: string) {
  return order.buyerId === userId || order.items.some((item: any) => item.product.sellerId === userId);
}

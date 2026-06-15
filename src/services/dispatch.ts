import { db } from "../lib/db";
import { config } from "../utils/config";
import { recordOrderActivity } from "./order-activity";

type DeliveryServiceLevel = "STANDARD" | "EXPRESS" | "SCHEDULED";
type DeliveryStatus =
  | "PENDING"
  | "QUOTED"
  | "READY_FOR_PICKUP"
  | "DISPATCH_REQUESTED"
  | "DISPATCHED"
  | "IN_TRANSIT"
  | "ARRIVED"
  | "DELIVERED"
  | "CANCELLED"
  | "FAILED"
  | "RETURNED";

type DispatchProvider = "KWIK" | "MANUAL";

type DeliveryAddress = {
  street: string;
  city: string;
  state: string;
  country: string;
  contactName?: string | null;
  contactPhone?: string | null;
  deliveryInstructions?: string | null;
  landmark?: string | null;
  latitude?: unknown;
  longitude?: unknown;
};

type QuoteInput = {
  address: DeliveryAddress;
  pickupAddress?: DeliveryAddress;
  itemCount: number;
  serviceLevel?: DeliveryServiceLevel;
};

type KwikSession = {
  accessToken: string;
  vendorId: number;
  userId: number;
  customerId: number;
  formId: number;
  customFieldTemplate: string;
};

type KwikQuoteBundle = {
  pricing: any;
  billBreakdown: any;
};

const KWIK_STATUS_MAP: Record<string, DeliveryStatus> = {
  "0": "DISPATCH_REQUESTED",
  "1": "IN_TRANSIT",
  "2": "DELIVERED",
  "3": "FAILED",
  "4": "ARRIVED",
  "6": "PENDING",
  "7": "DISPATCHED",
  "8": "FAILED",
  "9": "CANCELLED",
  "10": "CANCELLED",
  upcoming: "DISPATCH_REQUESTED",
  started: "IN_TRANSIT",
  ended: "DELIVERED",
  failed: "FAILED",
  arrived: "ARRIVED",
  unassigned: "PENDING",
  accepted: "DISPATCHED",
  decline: "FAILED",
  declined: "FAILED",
  cancel: "CANCELLED",
  cancelled: "CANCELLED",
  deleted: "CANCELLED",
};

let cachedKwikSession: { value: KwikSession; expiresAt: number } | null = null;

export function normalizeDispatchProvider(provider?: string): DispatchProvider {
  return provider?.toUpperCase() === "MANUAL" ? "MANUAL" : "KWIK";
}

export function ensureLagosDelivery(
  address: Pick<DeliveryAddress, "state" | "country">,
  label = "Delivery address",
) {
  const country = normalizeLocationName(address.country);
  const state = normalizeLocationName(address.state).replace(/\s+state$/, "");

  if (!country.split(" ").includes("nigeria")) {
    throw new Error(`${label} must be in Nigeria`);
  }

  if (!state.split(" ").includes("lagos")) {
    throw new Error(`${label} must be within Lagos`);
  }
}

export async function getDispatchQuote(input: QuoteInput) {
  ensureLagosDelivery(input.address, "Delivery address");
  const pickupAddress = input.pickupAddress || getConfiguredPickupAddress();
  ensureLagosDelivery(pickupAddress, "Pickup address");

  const serviceLevel = input.serviceLevel || "STANDARD";
  const localQuote = calculateLocalDeliveryFee(input.itemCount, serviceLevel);

  if (!isKwikLive()) {
    return {
      provider: normalizeDispatchProvider(config.DISPATCH_PROVIDER),
      serviceLevel,
      amount: localQuote,
      currency: "NGN",
      isLive: false,
      message: "Manual dispatch quote. Enable live Kwik mode for provider pricing.",
    };
  }

  try {
    const session = await getKwikSession();
    const pricing = await kwikRequest(
      config.KWIK_PRICING_PATH,
      buildKwikPricingPayload(input.address, pickupAddress, session, serviceLevel),
    );
    const billBreakdown = await kwikRequest(
      config.KWIK_BILL_BREAKDOWN_PATH,
      buildKwikBillBreakdownPayload(pricing, session),
    );
    const providerResponse: KwikQuoteBundle = { pricing, billBreakdown };
    const amount = extractAmount(providerResponse);

    if (!amount || amount <= 0) {
      throw new Error("Kwik returned an invalid delivery amount");
    }

    return {
      provider: "KWIK" as const,
      serviceLevel,
      amount,
      currency: extractCurrency(providerResponse) || "NGN",
      isLive: true,
      providerResponse,
    };
  } catch (error: any) {
    throw new Error(`Kwik quote failed: ${error.message || "unknown provider error"}`);
  }
}

export async function createDispatchShipment(input: { orderId: string }) {
  const order = await db.order.findUnique({
    where: { id: input.orderId },
    include: {
      buyer: true,
      address: true,
      shipment: true,
      items: {
        include: {
          product: {
            include: {
              seller: {
                include: {
                  addresses: {
                    orderBy: [{ isDefault: "desc" }],
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!order) {
    throw new Error("Order not found");
  }

  if (order.status !== "PROCESSING" && order.status !== "SHIPPED") {
    throw new Error("Order must be paid and processing before dispatch can be created");
  }

  ensureLagosDelivery(order.address, "Delivery address");

  const shipment = order.shipment || await db.shipment.create({
    data: buildShipmentSnapshot(order),
  });

  if (shipment.status === "DELIVERED" || shipment.status === "CANCELLED") {
    return shipment;
  }

  if (!isKwikLive()) {
    const manualShipment = await updateShipmentStatus(shipment.id, "READY_FOR_PICKUP", {
      message: "Shipment is ready for manual dispatch assignment",
    });

    await recordOrderActivity({
      orderId: order.id,
      type: "DISPATCH_CREATED",
      message: "Manual dispatch record prepared",
      metadata: { shipmentId: shipment.id, provider: shipment.provider },
    });

    return manualShipment;
  }

  try {
    const session = await getKwikSession();
    const quoteBundle = await getOrCreateKwikQuoteBundle(order, shipment);
    const providerResponse = await kwikRequest(
      config.KWIK_CREATE_TASK_PATH,
      buildKwikCreateTaskPayload(quoteBundle, session),
    );

    const updatedShipment = await db.shipment.update({
      where: { id: shipment.id },
      data: {
        status: "DISPATCH_REQUESTED",
        externalShipmentId: extractExternalId(providerResponse),
        externalTrackingId: extractTrackingId(providerResponse),
        trackingUrl: extractTrackingUrl(providerResponse),
        providerPayload: providerResponse,
        failureReason: null,
        dispatchedAt: new Date(),
        events: {
          create: {
            status: "DISPATCH_REQUESTED",
            providerStatus: extractProviderStatus(providerResponse),
            message: "Kwik pickup and delivery task created",
            providerPayload: providerResponse,
          },
        },
      },
    });

    await db.order.update({
      where: { id: order.id },
      data: { status: "SHIPPED" },
    });

    await recordOrderActivity({
      orderId: order.id,
      type: "DISPATCH_CREATED",
      message: "Kwik pickup and delivery task created",
      metadata: {
        shipmentId: shipment.id,
        uniqueOrderId: updatedShipment.externalShipmentId,
        trackingUrl: updatedShipment.trackingUrl,
      },
    });

    return updatedShipment;
  } catch (error: any) {
    const failedShipment = await updateShipmentStatus(shipment.id, "FAILED", {
      message: error.message || "Unable to create Kwik dispatch task",
    });

    await recordOrderActivity({
      orderId: order.id,
      type: "FAILED",
      message: "Kwik dispatch handoff failed",
      metadata: { shipmentId: shipment.id, error: error.message },
    });

    return failedShipment;
  }
}

export async function syncDispatchShipmentStatus(orderId: string) {
  const shipment = await db.shipment.findUnique({ where: { orderId } });

  if (!shipment) {
    throw new Error("Shipment not found");
  }

  if (shipment.provider !== "KWIK" || !shipment.externalShipmentId) {
    throw new Error("Shipment has no Kwik order id to sync");
  }

  const session = await getKwikSession();
  const providerResponse = await kwikRequest(
    config.KWIK_TASK_DETAILS_PATH,
    {
      access_token: session.accessToken,
      unique_order_id: shipment.externalShipmentId,
    },
    "GET",
  );
  const deliveryJob = getKwikDeliveryJob(providerResponse);
  const status = mapProviderStatus(deliveryJob?.job_status);

  if (status === shipment.status) {
    return shipment;
  }

  return updateShipmentStatus(shipment.id, status, {
    providerStatus: String(deliveryJob?.job_status ?? ""),
    message: `Kwik shipment status synced to ${status}`,
    providerPayload: providerResponse,
  });
}

export async function cancelDispatchShipment(orderId: string) {
  const shipment = await db.shipment.findUnique({ where: { orderId } });

  if (!shipment) {
    throw new Error("Shipment not found");
  }

  if (shipment.status === "DELIVERED") {
    throw new Error("Delivered shipments cannot be cancelled");
  }

  if (shipment.provider !== "KWIK") {
    return updateShipmentStatus(shipment.id, "CANCELLED", {
      message: "Manual shipment cancelled",
      providerStatus: "manual",
    });
  }

  const session = await getKwikSession();
  const jobIds = extractKwikJobIds(shipment.providerPayload);

  if (jobIds.length === 0) {
    throw new Error("Kwik job ids are missing from the shipment");
  }

  const providerResponse = await kwikRequest(config.KWIK_CANCEL_TASK_PATH, {
    access_token: session.accessToken,
    vendor_id: session.vendorId,
    job_id: jobIds.join(","),
    job_status: 9,
    domain_name: config.KWIK_DOMAIN_NAME,
  });

  return updateShipmentStatus(shipment.id, "CANCELLED", {
    providerStatus: "9",
    message: "Kwik shipment cancelled",
    providerPayload: providerResponse,
  });
}

export async function updateShipmentStatus(
  shipmentId: string,
  status: DeliveryStatus,
  options: {
    message?: string;
    providerStatus?: string;
    providerPayload?: Record<string, unknown>;
  } = {},
) {
  const timestampField = getShipmentTimestampField(status);

  const shipment = await db.shipment.update({
    where: { id: shipmentId },
    data: {
      status,
      ...(status === "FAILED" ? { failureReason: options.message } : {}),
      ...(timestampField ? { [timestampField]: new Date() } : {}),
      events: {
        create: {
          status,
          providerStatus: options.providerStatus,
          message: options.message,
          providerPayload: options.providerPayload as any,
        },
      },
    },
    include: { order: true },
  });

  if (status === "DISPATCHED" || status === "IN_TRANSIT" || status === "ARRIVED") {
    await db.order.update({
      where: { id: shipment.orderId },
      data: { status: "SHIPPED" },
    });
  }

  if (status === "DELIVERED") {
    await db.order.update({
      where: { id: shipment.orderId },
      data: { status: "DELIVERED" },
    });
    await settleSellerWalletsForDeliveredOrder(shipment.orderId);
  }

  if (status === "CANCELLED" || status === "FAILED" || status === "RETURNED") {
    await db.order.update({
      where: { id: shipment.orderId },
      data: { status: "PROCESSING" },
    });
  }

  await recordOrderActivity({
    orderId: shipment.orderId,
    type: "DISPATCH_STATUS_UPDATED",
    message: options.message || `Shipment status updated to ${status}`,
    metadata: {
      shipmentId,
      status,
      providerStatus: options.providerStatus,
    },
  });

  return shipment;
}

export function mapProviderStatus(status: unknown): DeliveryStatus {
  const normalized = String(status ?? "").trim().toLowerCase();
  return KWIK_STATUS_MAP[normalized] || "IN_TRANSIT";
}

function calculateLocalDeliveryFee(itemCount: number, serviceLevel: DeliveryServiceLevel) {
  const baseFee = Number.isFinite(config.DISPATCH_BASE_FEE_NAIRA)
    ? config.DISPATCH_BASE_FEE_NAIRA
    : 1500;
  const extraItemFee = Number.isFinite(config.DISPATCH_EXTRA_ITEM_FEE_NAIRA)
    ? config.DISPATCH_EXTRA_ITEM_FEE_NAIRA
    : 200;
  const levelMultiplier = serviceLevel === "EXPRESS" ? 1.35 : 1;

  return Math.round((baseFee + Math.max(itemCount - 1, 0) * extraItemFee) * levelMultiplier);
}

function isKwikLive() {
  const hasStaticSession = Boolean(
    config.KWIK_ACCESS_TOKEN &&
    config.KWIK_VENDOR_ID &&
    config.KWIK_USER_ID &&
    config.KWIK_CUSTOMER_ID,
  );
  const hasLoginCredentials = Boolean(config.KWIK_EMAIL && config.KWIK_PASSWORD);

  return (
    config.DISPATCH_MODE.toLowerCase() === "live" &&
    normalizeDispatchProvider(config.DISPATCH_PROVIDER) === "KWIK" &&
    Boolean(config.KWIK_API_BASE_URL) &&
    (hasStaticSession || hasLoginCredentials)
  );
}

async function getKwikSession(forceLogin = false): Promise<KwikSession> {
  if (!forceLogin && cachedKwikSession && cachedKwikSession.expiresAt > Date.now()) {
    return cachedKwikSession.value;
  }

  if (
    !forceLogin &&
    config.KWIK_ACCESS_TOKEN &&
    config.KWIK_VENDOR_ID &&
    config.KWIK_USER_ID &&
    config.KWIK_CUSTOMER_ID
  ) {
    return {
      accessToken: config.KWIK_ACCESS_TOKEN,
      vendorId: config.KWIK_VENDOR_ID,
      userId: config.KWIK_USER_ID,
      customerId: config.KWIK_CUSTOMER_ID,
      formId: config.KWIK_FORM_ID,
      customFieldTemplate: config.KWIK_CUSTOM_FIELD_TEMPLATE,
    };
  }

  if (!config.KWIK_EMAIL || !config.KWIK_PASSWORD) {
    throw new Error("Kwik email and password are required for live API login");
  }

  const response = await kwikRequest(config.KWIK_LOGIN_PATH, {
    domain_name: config.KWIK_DOMAIN_NAME,
    email: config.KWIK_EMAIL,
    password: config.KWIK_PASSWORD,
    api_login: 1,
  });
  const vendor = response?.data?.vendor_details;
  const form = response?.data?.formSettings?.[0];

  const session: KwikSession = {
    accessToken: String(response?.data?.access_token || vendor?.access_token || ""),
    vendorId: Number(vendor?.vendor_id || 0),
    userId: Number(vendor?.user_id || form?.user_id || 0),
    customerId: Number(vendor?.customer_id || 0),
    formId: Number(form?.form_id || config.KWIK_FORM_ID),
    customFieldTemplate: String(
      form?.selected_template ||
      form?.delivery_template ||
      config.KWIK_CUSTOM_FIELD_TEMPLATE,
    ),
  };

  if (!session.accessToken || !session.vendorId || !session.userId || !session.customerId) {
    throw new Error("Kwik login response is missing API account identifiers");
  }

  cachedKwikSession = {
    value: session,
    expiresAt: Date.now() + 50 * 60 * 1000,
  };

  return session;
}

async function kwikRequest(
  path: string,
  payload: Record<string, unknown> = {},
  method = "POST",
) {
  const baseUrl = config.KWIK_API_BASE_URL.replace(/\/$/, "");
  const endpoint = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`${baseUrl}${endpoint}`);

  if (method === "GET") {
    for (const [key, value] of Object.entries(payload)) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: method === "GET" ? undefined : JSON.stringify(payload),
  });
  const responseBody = await parseJsonResponse(response);
  const providerStatus = Number(responseBody?.status);

  if (!response.ok || (Number.isFinite(providerStatus) && providerStatus !== 200)) {
    throw new Error(extractMessage(responseBody) || `Kwik request failed with status ${response.status}`);
  }

  return responseBody;
}

async function parseJsonResponse(response: Response) {
  const text = await response.text();
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function buildKwikPricingPayload(
  address: DeliveryAddress,
  pickupAddress: DeliveryAddress,
  session: KwikSession,
  serviceLevel: DeliveryServiceLevel,
) {
  validateKwikStops(address, pickupAddress);
  const pickupTime = formatKwikDate(new Date(Date.now() + 15 * 60 * 1000));
  const deliveryTime = formatKwikDate(new Date(Date.now() + (serviceLevel === "EXPRESS" ? 75 : 120) * 60 * 1000));

  return {
    custom_field_template: session.customFieldTemplate,
    pickup_custom_field_template: session.customFieldTemplate,
    access_token: session.accessToken,
    domain_name: config.KWIK_DOMAIN_NAME,
    timezone: config.KWIK_TIMEZONE,
    vendor_id: session.vendorId,
    is_multiple_tasks: 1,
    layout_type: 0,
    has_pickup: 1,
    has_delivery: 1,
    auto_assignment: config.KWIK_AUTO_ASSIGNMENT,
    user_id: session.userId,
    payment_method: config.KWIK_PAYMENT_METHOD,
    form_id: session.formId,
    is_schedule_task: serviceLevel === "SCHEDULED" ? 1 : 0,
    pickups: [{
      address: formatAddress(pickupAddress),
      name: pickupAddress.contactName || config.DISPATCH_PICKUP_NAME,
      latitude: numberFromUnknown(pickupAddress.latitude),
      longitude: numberFromUnknown(pickupAddress.longitude),
      time: pickupTime,
      phone: pickupAddress.contactPhone || config.DISPATCH_PICKUP_PHONE,
      email: config.DISPATCH_PICKUP_EMAIL || config.KWIK_EMAIL,
    }],
    deliveries: [{
      address: formatAddress(address),
      name: address.contactName || "Customer",
      latitude: numberFromUnknown(address.latitude),
      longitude: numberFromUnknown(address.longitude),
      time: deliveryTime,
      phone: address.contactPhone,
      email: "",
      has_return_task: false,
      is_package_insured: 0,
    }],
    vehicle_id: config.KWIK_VEHICLE_ID,
    delivery_instruction: address.deliveryInstructions || "",
    delivery_images: "",
    is_loader_required: 0,
    loaders_amount: 0,
    loaders_count: 0,
    is_cod_job: 0,
    parcel_amount: 0,
  };
}

function buildKwikBillBreakdownPayload(pricingResponse: any, session: KwikSession) {
  const data = pricingResponse?.data || {};

  return {
    access_token: session.accessToken,
    benefit_type: null,
    amount: data.per_task_cost,
    insurance_amount: data.insurance_amount || 0,
    total_no_of_tasks: data.total_no_of_tasks || 1,
    pickup_time: data.pickups?.[0]?.time,
    user_id: session.userId,
    form_id: session.formId,
    promo_value: null,
    domain_name: config.KWIK_DOMAIN_NAME,
    credits: 0,
    total_service_charge: data.total_service_charge || 0,
    vehicle_id: data.vehicle_id || config.KWIK_VEHICLE_ID,
    delivery_images: data.delivery_images || "",
    is_loader_required: data.is_loader_required || 0,
    loaders_amount: data.loaders_amount || 0,
    loaders_count: data.loaders_count || 0,
    is_cod_job: 0,
    parcel_amount: 0,
    delivery_charge_by_buyer: 1,
    delivery_instruction: data.delivery_instruction || "",
  };
}

function buildKwikCreateTaskPayload(bundle: KwikQuoteBundle, session: KwikSession) {
  const pricing = bundle.pricing?.data || {};
  const breakdown = bundle.billBreakdown?.data || {};

  return {
    domain_name: config.KWIK_DOMAIN_NAME,
    access_token: session.accessToken,
    vendor_id: session.vendorId,
    is_multiple_tasks: 1,
    fleet_id: "",
    latitude: 0,
    longitude: 0,
    timezone: config.KWIK_TIMEZONE,
    has_pickup: 1,
    has_delivery: 1,
    pickup_delivery_relationship: 0,
    layout_type: 0,
    auto_assignment: config.KWIK_AUTO_ASSIGNMENT,
    team_id: config.KWIK_TEAM_ID,
    pickups: pricing.pickups,
    deliveries: pricing.deliveries,
    insurance_amount: pricing.insurance_amount || 0,
    total_no_of_tasks: pricing.total_no_of_tasks || 1,
    total_service_charge: pricing.total_service_charge || 0,
    payment_method: config.KWIK_PAYMENT_METHOD,
    amount: pricing.per_task_cost,
    surge_cost: breakdown.SURGE_PRICING || 0,
    surge_type: breakdown.SURGE_TYPE || 0,
    delivery_instruction: pricing.delivery_instruction || "",
    loaders_amount: pricing.loaders_amount || 0,
    loaders_count: pricing.loaders_count || 0,
    is_loader_required: pricing.is_loader_required || 0,
    delivery_images: pricing.delivery_images || "",
    vehicle_id: pricing.vehicle_id || config.KWIK_VEHICLE_ID,
    is_cod_job: 0,
    is_task_otp_required: 1,
  };
}

async function getOrCreateKwikQuoteBundle(order: any, shipment: any): Promise<KwikQuoteBundle> {
  const stored = shipment.providerPayload as any;
  if (stored?.pricing?.data && stored?.billBreakdown?.data) {
    return stored;
  }

  const quote = await getDispatchQuote({
    address: order.address,
    pickupAddress: resolvePickupAddressForOrderItems(order.items),
    itemCount: order.items.reduce((sum: number, item: any) => sum + item.quantity, 0),
    serviceLevel: shipment.serviceLevel,
  });

  if (!("providerResponse" in quote) || !quote.providerResponse) {
    throw new Error("A live Kwik quote is required before task creation");
  }

  return quote.providerResponse;
}

function buildShipmentSnapshot(order: any) {
  const pickupAddress = resolvePickupAddressForOrderItems(order.items);

  return {
    orderId: order.id,
    provider: normalizeDispatchProvider(config.DISPATCH_PROVIDER),
    serviceLevel: "STANDARD" as DeliveryServiceLevel,
    status: "QUOTED" as DeliveryStatus,
    deliveryFee: Number(order.deliveryFee),
    currency: "NGN",
    pickupName: pickupAddress.contactName || config.DISPATCH_PICKUP_NAME,
    pickupPhone: pickupAddress.contactPhone || config.DISPATCH_PICKUP_PHONE,
    pickupAddress: formatAddress(pickupAddress),
    pickupCity: pickupAddress.city,
    pickupState: pickupAddress.state,
    dropoffName: order.address.contactName || order.buyer.name,
    dropoffPhone: order.address.contactPhone,
    dropoffAddress: formatAddress(order.address),
    dropoffCity: order.address.city,
    dropoffState: order.address.state,
    dropoffInstructions: order.address.deliveryInstructions,
  };
}

function validateKwikStops(address: DeliveryAddress, pickupAddress: DeliveryAddress) {
  if (
    !pickupAddress.street ||
    !pickupAddress.contactPhone ||
    !numberFromUnknown(pickupAddress.latitude) ||
    !numberFromUnknown(pickupAddress.longitude)
  ) {
    throw new Error("Dispatch pickup address, phone, latitude, and longitude are required");
  }

  if (!address.contactPhone || !numberFromUnknown(address.latitude) || !numberFromUnknown(address.longitude)) {
    throw new Error("Delivery address phone, latitude, and longitude are required for Kwik");
  }
}

function getConfiguredPickupAddress(): DeliveryAddress {
  return {
    street: config.DISPATCH_PICKUP_ADDRESS,
    city: config.DISPATCH_PICKUP_CITY,
    state: config.DISPATCH_PICKUP_STATE,
    country: "Nigeria",
    contactName: config.DISPATCH_PICKUP_NAME,
    contactPhone: config.DISPATCH_PICKUP_PHONE,
    latitude: config.DISPATCH_PICKUP_LATITUDE,
    longitude: config.DISPATCH_PICKUP_LONGITUDE,
  };
}

export function resolvePickupAddressForOrderItems(items: any[]): DeliveryAddress {
  const sellers = new Map<string, any>();

  for (const item of items) {
    const sellerId = item.product?.sellerId;
    if (!sellerId) {
      continue;
    }

    sellers.set(sellerId, item.product?.seller);
  }

  if (sellers.size === 0) {
    throw new Error("Order items must include seller details for dispatch pickup");
  }

  if (sellers.size > 1) {
    throw new Error("Checkout currently supports one seller per order. Please split multi-seller carts into separate orders.");
  }

  const seller = sellers.values().next().value;
  const addresses = seller?.addresses || [];
  const pickupAddress =
    addresses.find((address: any) => address.type === "PICKUP" && address.isDefault) ||
    addresses.find((address: any) => address.type === "PICKUP") ||
    addresses.find((address: any) => address.type === "SHIPPING" && address.isDefault) ||
    addresses.find((address: any) => address.type === "SHIPPING");

  if (!pickupAddress) {
    throw new Error("Seller needs a Lagos pickup address before this item can be checked out");
  }

  return pickupAddress;
}

function formatAddress(address: DeliveryAddress) {
  return [address.street, address.landmark, address.city, address.state, address.country]
    .filter(Boolean)
    .join(", ");
}

function formatKwikDate(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date).replace(",", "");
}

function numberFromUnknown(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeLocationName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractAmount(response: any) {
  return Number(
    response?.billBreakdown?.data?.NET_PAYABLE_AMOUNT ||
    response?.billBreakdown?.data?.ORDER_PAYABLE_AMOUNT ||
    response?.billBreakdown?.data?.PAYABLE_AMOUNT ||
    response?.pricing?.data?.per_task_cost ||
    response?.data?.per_task_cost ||
    response?.data?.amount ||
    0,
  );
}

function extractCurrency(response: any) {
  return response?.pricing?.data?.currency?.code || response?.data?.currency?.code || response?.data?.currency;
}

function extractExternalId(response: any) {
  return String(response?.data?.unique_order_id || response?.unique_order_id || "");
}

function extractTrackingId(response: any) {
  return String(
    response?.data?.deliveries?.[0]?.job_id ||
    response?.data?.pickups?.[0]?.job_id ||
    "",
  );
}

function extractTrackingUrl(response: any) {
  return (
    response?.data?.deliveries?.[0]?.result_tracking_link ||
    response?.data?.pickups?.[0]?.result_tracking_link ||
    response?.data?.job_status_check_link
  );
}

function extractProviderStatus(response: any) {
  return String(
    response?.data?.deliveries?.[0]?.job_status ||
    response?.data?.pickups?.[0]?.job_status ||
    response?.status ||
    "",
  );
}

function extractKwikJobIds(providerPayload: unknown) {
  const payload = providerPayload as any;
  return [
    ...(payload?.data?.pickups || []),
    ...(payload?.data?.deliveries || []),
  ]
    .map((job: any) => job?.job_id)
    .filter(Boolean)
    .map(String);
}

function getKwikDeliveryJob(providerResponse: any) {
  const jobs = providerResponse?.data?.orders || [];
  return jobs.find((job: any) => Number(job.job_type) === 1) || jobs[jobs.length - 1];
}

function extractMessage(response: any) {
  return response?.message || response?.error || response?.data?.message;
}

function getShipmentTimestampField(status: DeliveryStatus) {
  if (status === "DISPATCHED" || status === "DISPATCH_REQUESTED") return "dispatchedAt";
  if (status === "ARRIVED") return "pickedUpAt";
  if (status === "DELIVERED") return "deliveredAt";
  if (status === "CANCELLED") return "cancelledAt";
  return null;
}

async function settleSellerWalletsForDeliveredOrder(orderId: string) {
  await db.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: {
        subtotalAmount: true,
        commissionAmount: true,
        sellerPayoutAmount: true,
      },
    });

    if (!order) {
      throw new Error("Order not found for seller settlement");
    }

    const unsettledItems = await tx.orderItem.findMany({
      where: {
        orderId,
        sellerSettledAt: null,
      },
      include: {
        product: {
          select: {
            sellerId: true,
          },
        },
      },
    });

    if (unsettledItems.length === 0) {
      return;
    }

    const subtotalAmount = Number(order.subtotalAmount);
    const sellerPayoutAmount = Number(order.sellerPayoutAmount);
    const commissionAmount = Number(order.commissionAmount);
    const fallbackPayout = unsettledItems.reduce(
      (sum, item) => sum + Number(item.price) * item.quantity,
      0,
    );
    const payoutPool = sellerPayoutAmount > 0 ? sellerPayoutAmount : fallbackPayout;

    const payoutsBySeller = new Map<string, { amount: number; items: typeof unsettledItems }>();
    for (const item of unsettledItems) {
      const grossItemAmount = Number(item.price) * item.quantity;
      const itemPayout =
        subtotalAmount > 0 && sellerPayoutAmount > 0
          ? roundMoney((grossItemAmount / subtotalAmount) * payoutPool)
          : grossItemAmount;
      const sellerId = item.product.sellerId;
      const sellerPayout = payoutsBySeller.get(sellerId) || { amount: 0, items: [] as typeof unsettledItems };
      sellerPayout.amount = roundMoney(sellerPayout.amount + itemPayout);
      sellerPayout.items.push(item);
      payoutsBySeller.set(sellerId, sellerPayout);
    }

    for (const [sellerId, payout] of payoutsBySeller.entries()) {
      const amountInKobo = Math.round(payout.amount * 100);

      await tx.wallet.upsert({
        where: { userId: sellerId },
        update: { balance: { increment: amountInKobo } },
        create: { userId: sellerId, balance: amountInKobo },
      });

      await tx.orderItem.updateMany({
        where: { id: { in: payout.items.map((item) => item.id) } },
        data: { sellerSettledAt: new Date() },
      });
    }

    await tx.orderActivity.create({
      data: {
        orderId,
        type: "ORDER_STATUS_UPDATED",
        message: "Seller wallets settled after delivery confirmation",
        metadata: {
          settledItems: unsettledItems.map((item) => ({
            orderItemId: item.id,
            sellerId: item.product.sellerId,
            grossAmount: Number(item.price) * item.quantity,
          })),
          commissionAmount,
          sellerPayoutAmount: payoutPool,
          payoutsBySeller: Array.from(payoutsBySeller.entries()).map(([sellerId, payout]) => ({
            sellerId,
            amount: payout.amount,
          })),
        } as any,
      },
    });
  });
}

function roundMoney(amount: number) {
  return Math.round(amount * 100) / 100;
}

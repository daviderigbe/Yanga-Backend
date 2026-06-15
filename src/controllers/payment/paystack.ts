import { t } from "elysia";
import { createBaseElysia } from "../../base";
import {
  initializePayment,
  verifyPayment,
  verifyPaystackSignature,
  nairaToKobo,
  koboToNaira,
  withdrawFromWallet,
  getSupportedBanks, withdrawToBank
} from "../../services/paystack";
import {db} from "../../lib/db";
import { validateSessionToken } from "../../lib/auth";
import { createDispatchShipment, getDispatchQuote, resolvePickupAddressForOrderItems } from "../../services/dispatch";
import { recordOrderActivity } from "../../services/order-activity";
import { config } from "../../utils/config";

export const paystackRoutes = createBaseElysia()
export const walletRoutes = createBaseElysia()
export const orderRoutes = createBaseElysia()
    // Create order and initialize payment
    .post(
        "/orders/create",
        async ({ body, set, cookie: { session } }) => {
          try {
            const { buyerId: requestedBuyerId, items, addressId, isBundle, callbackUrl: customCallbackUrl } = body;
            const authenticatedUser = await resolveCheckoutUser(session.value);
            const buyerId = authenticatedUser?.id || requestedBuyerId;

            if (!buyerId) {
              set.status = 400;
              return { status: "error", message: "buyerId or valid session is required" };
            }

            if (authenticatedUser && requestedBuyerId && requestedBuyerId !== authenticatedUser.id) {
              set.status = 403;
              return { status: "error", message: "buyerId does not match active session" };
            }

            if (!customCallbackUrl) {
              set.status = 400;
              return {
                status: "error",
                message: "callbackUrl is required"
              };
            }

            // Validate user exists
            const user = await db.user.findUnique({
              where: { id: buyerId },
            });
            if (!user) {
              set.status = 404;
              return { status: "error", message: "User not found" };
            }

            // Validate address
            const address = await db.address.findUnique({
              where: { id: addressId },
            });
            if (!address || address.userId !== buyerId) {
              set.status = 400;
              return { status: "error", message: "Invalid address" };
            }

            const mergedItems = mergeOrderItems(items);

            // Validate products and calculate subtotal
            let subtotalAmount = 0;
            const validatedItems = [];

            for (const item of mergedItems) {
              const product = await db.product.findUnique({
                where: { id: item.productId },
                include: {
                  seller: {
                    include: {
                      addresses: {
                        orderBy: [{ isDefault: "desc" }],
                      },
                    },
                  },
                },
              });

              if (!product) {
                set.status = 400;
                return {
                  status: "error",
                  message: `Product ${item.productId} not found`
                };
              }

              if (product.sellerId === buyerId) {
                set.status = 400;
                return {
                  status: "error",
                  message: `You cannot buy your own product "${product.title}"`
                };
              }

              if (!product.isAvailable || product.status !== "ACTIVE") {
                set.status = 400;
                return {
                  status: "error",
                  message: `Product "${product.title}" is no longer available`
                };
              }

              if (product.quantity < item.quantity) {
                set.status = 400;
                return {
                  status: "error",
                  message: `Only ${product.quantity} unit(s) of "${product.title}" are available`
                };
              }

              // Calculate price (apply discount if exists)
              let price = Number(product.basePrice);
              if (product.discountPercent) {
                price = price * (1 - product.discountPercent / 100);
              }

              subtotalAmount += price * item.quantity;
              validatedItems.push({
                productId: product.id,
                quantity: item.quantity,
                price: price,
                product,
              });
            }

            const pickupAddress = resolvePickupAddressForOrderItems(
              validatedItems.map((item) => ({ product: item.product })),
            );
            const quote = await getDispatchQuote({
              address,
              pickupAddress,
              itemCount: mergedItems.reduce((sum, item) => sum + item.quantity, 0),
              serviceLevel: body.deliveryServiceLevel,
            });
            const providerDeliveryFee = quote.amount;
            const fees = calculateMarketplaceFees(subtotalAmount, providerDeliveryFee);
            const totalAmount = fees.totalAmount;

            // Create the order
            const order = await db.order.create({
              data: {
                buyerId,
                addressId,
                isBundle,
                subtotalAmount,
                providerDeliveryFee,
                deliveryMarkup: fees.deliveryMarkup,
                deliveryFee: fees.deliveryFee,
                serviceFee: fees.serviceFee,
                commissionAmount: fees.commissionAmount,
                sellerPayoutAmount: fees.sellerPayoutAmount,
                platformRevenueAmount: fees.platformRevenueAmount,
                totalAmount,
                status: "PENDING",
                items: {
                  create: validatedItems.map(({ product, ...item }) => item),
                },
                shipment: {
                  create: {
                    provider: quote.provider,
                    serviceLevel: quote.serviceLevel,
                    status: "QUOTED",
                    deliveryFee: fees.deliveryFee,
                    currency: quote.currency,
                    pickupName: pickupAddress.contactName || config.DISPATCH_PICKUP_NAME,
                    pickupPhone: pickupAddress.contactPhone || config.DISPATCH_PICKUP_PHONE,
                    pickupAddress: [pickupAddress.street, pickupAddress.landmark, pickupAddress.city, pickupAddress.state, pickupAddress.country].filter(Boolean).join(", "),
                    pickupCity: pickupAddress.city,
                    pickupState: pickupAddress.state,
                    dropoffName: address.contactName || user.name,
                    dropoffPhone: address.contactPhone,
                    dropoffAddress: [address.street, address.landmark, address.city, address.state, address.country].filter(Boolean).join(", "),
                    dropoffCity: address.city,
                    dropoffState: address.state,
                    dropoffInstructions: address.deliveryInstructions,
                    providerPayload: "providerResponse" in quote ? quote.providerResponse as any : undefined,
                    events: {
                      create: {
                        status: "QUOTED",
                        message: quote.message || "Delivery quote attached to order",
                        providerPayload: "providerResponse" in quote ? quote.providerResponse as any : undefined,
                      },
                    },
                  },
                },
              },
              include: {
                items: {
                  include: {
                    product: true,
                  },
                },
                shipment: true,
              },
            });

            await recordOrderActivity({
              orderId: order.id,
              type: "CREATED",
              message: "Order created with delivery quote",
              metadata: {
                subtotalAmount,
                providerDeliveryFee,
                deliveryMarkup: fees.deliveryMarkup,
                deliveryFee: fees.deliveryFee,
                serviceFee: fees.serviceFee,
                commissionAmount: fees.commissionAmount,
                sellerPayoutAmount: fees.sellerPayoutAmount,
                platformRevenueAmount: fees.platformRevenueAmount,
                totalAmount,
                dispatchProvider: quote.provider,
                dispatchLive: quote.isLive,
              },
            });

            const separator = customCallbackUrl.includes("?") ? "&" : "?";
            const finalCallbackUrl = `${customCallbackUrl}${separator}orderId=${order.id}`;

            const payment = await initializePayment(
              user.email,
              nairaToKobo(Number(totalAmount)),
              finalCallbackUrl
            );

            // Store payment reference in order for tracking
            await db.order.update({
              where: { id: order.id },
              data: {
                paymentReference: payment.data.reference,
              },
            });

            await recordOrderActivity({
              orderId: order.id,
              type: "PAYMENT_INITIALIZED",
              message: "Paystack payment initialized",
              metadata: {
                reference: payment.data.reference,
                amount: totalAmount,
              },
            });

            return {
              status: "success",
              order: {
                id: order.id,
                subtotalAmount: Number(subtotalAmount),
                providerDeliveryFee: Number(providerDeliveryFee),
                deliveryMarkup: Number(fees.deliveryMarkup),
                deliveryFee: Number(fees.deliveryFee),
                serviceFee: Number(fees.serviceFee),
                commissionAmount: Number(fees.commissionAmount),
                sellerPayoutAmount: Number(fees.sellerPayoutAmount),
                platformRevenueAmount: Number(fees.platformRevenueAmount),
                totalAmount: Number(totalAmount),
                items: order.items,
                shipment: order.shipment,
              },
              payment: {
                authorizationUrl: payment.data.authorization_url,
                accessCode: payment.data.access_code,
                reference: payment.data.reference,
              },
            };
          } catch (err: any) {
            console.error("Order creation error:", err);
            set.status = 500;
            return {
              status: "error",
              message: err.message || "Failed to create order"
            };
          }
        },
        {
          body: t.Object({
            buyerId: t.Optional(t.String()),
            items: t.Array(
                t.Object({
                  productId: t.String(),
                  quantity: t.Number({ minimum: 1 }),
                })
            ),
            addressId: t.String(),
            isBundle: t.Optional(t.Boolean()),
            callbackUrl: t.String(),
            deliveryServiceLevel: t.Optional(
              t.Union([t.Literal("STANDARD"), t.Literal("EXPRESS"), t.Literal("SCHEDULED")]),
            ),
          }),
          detail: {
            tags: ["Orders"],
            summary: "Create order and initialize payment",
            description: "Creates an order, attaches a Lagos delivery quote, and returns Paystack payment URL",
          },
        }
    )

    // Verify payment and complete order
    .post(
        "/orders/verify-payment",
        async ({ body, set }) => {
          try {
            const { orderId, reference } = body;

            // Find the order
            const order = await db.order.findUnique({
              where: { id: orderId },
              include: {
                items: {
                  include: { product: true },
                },
                shipment: true,
              },
            });

            if (!order) {
              set.status = 404;
              return { status: "error", message: "Order not found" };
            }

            // Check if order was already processed
            if (order.status !== "PENDING") {
              return {
                status: "success",
                message: "Order already processed",
                order: {
                  id: order.id,
                  status: order.status,
                },
              };
            }

            // Check if this reference was already used for another order
            if (order.paymentReference && order.paymentReference !== reference) {
              set.status = 400;
              return {
                status: "error",
                message: "Invalid payment reference for this order"
              };
            }

            // Verify payment with Paystack
            const verification = await verifyPayment(reference);

            if (verification.data.status !== "success") {
              set.status = 400;
              return {
                status: "error",
                message: "Payment verification failed"
              };
            }

            // Check if payment amount matches order total
            const paidAmount = verification.data.amount / 100; // Convert from kobo
            if (Math.abs(paidAmount - Number(order.totalAmount)) > 0.01) {
              set.status = 400;
              return {
                status: "error",
                message: "Payment amount mismatch"
              };
            }

            // Use transaction to prevent race conditions
            await db.$transaction(async (tx) => {
              // Double-check order status within transaction
              const currentOrder = await tx.order.findUnique({
                where: { id: orderId },
                select: { status: true, paymentReference: true },
              });

              if (currentOrder?.status !== "PENDING") {
                throw new Error("Order already processed");
              }

              // Update order status and confirm payment
              await tx.order.update({
                where: { id: orderId },
                data: {
                  status: "PROCESSING",
                  paymentReference: reference,
                },
              });

              await tx.orderActivity.create({
                data: {
                  orderId,
                  type: "PAYMENT_VERIFIED",
                  message: "Paystack payment verified; seller settlement pending delivery",
                  metadata: {
                    reference,
                    paidAmount,
                  },
                },
              });

              // Update product stock and availability
              for (const item of order.items) {
                const product = await tx.product.findUnique({
                  where: { id: item.productId },
                  select: { quantity: true },
                });

                if (!product) {
                  throw new Error(`Product ${item.productId} not found`);
                }

                  if (product.quantity < item.quantity) {
                    throw new Error(`Insufficient stock for product ${item.productId}`);
                  }

                const newQuantity = product.quantity - item.quantity;

                await tx.product.update({
                  where: { id: item.productId },
                  data: {
                    quantity: newQuantity < 0 ? 0 : newQuantity,
                    isAvailable: newQuantity > 0,
                    status: newQuantity > 0 ? "ACTIVE" : "SOLD",
                  },
                });
              }

              await tx.orderActivity.create({
                data: {
                  orderId,
                  type: "STOCK_RESERVED",
                  message: "Product stock reduced after payment verification",
                  metadata: {
                    items: order.items.map((item) => ({
                      productId: item.productId,
                      quantity: item.quantity,
                    })),
                  },
                },
              });
            });

            const shipment = await createDispatchShipment({ orderId });

            return {
              status: "success",
              message: "Payment verified and order completed",
              order: {
                id: order.id,
                status: shipment.status === "DISPATCH_REQUESTED" || shipment.status === "DISPATCHED" ? "SHIPPED" : "PROCESSING",
                shipment,
              },
            };
          } catch (err: any) {
            console.error("Payment verification error:", err);
            set.status = 500;
            return {
              status: "error",
              message: err.message || "Payment verification failed",
            };
          }
        },
        {
          body: t.Object({
            orderId: t.String(),
            reference: t.String(),
          }),
          detail: {
            tags: ["Orders"],
            summary: "Verify payment and complete order",
            description: "Verifies Paystack payment and updates order status",
          },
        }
    )

    // Get order details
    .get(
        "/orders/:orderId",
        async ({ params, set }) => {
          try {
            const order = await db.order.findUnique({
              where: { id: params.orderId },
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
                          },
                        },
                      },
                    },
                  },
                },
                address: true,
                shipment: {
                  include: {
                    events: {
                      orderBy: { createdAt: "desc" },
                    },
                  },
                },
                activities: {
                  orderBy: { createdAt: "desc" },
                },
                buyer: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                  },
                },
              },
            });

            if (!order) {
              set.status = 404;
              return { status: "error", message: "Order not found" };
            }

            return { status: "success", order };
          } catch (err: any) {
            set.status = 500;
            return { status: "error", message: "Failed to fetch order" };
          }
        },
        {
          params: t.Object({
            orderId: t.String(),
          }),
          detail: {
            tags: ["Orders"],
            summary: "Get order details",
          },
        }
    )

    // Get Wallet Balance
    .get(
        "/wallet/:userId/balance",
        async ({ params, set }) => {
          try {
            const { userId } = params;

            // Fetch the wallet for the user
            const wallet = await db.wallet.findUnique({
              where: { userId },
            });

            if (!wallet) {
              set.status = 404;
              return { status: "error", message: "Wallet not found for the given user" };
            }

            // Return the wallet balance in Naira
            return {
              status: "success",
              balance: koboToNaira(wallet.balance), // Convert from kobo to Naira for display
            };
          } catch (err: any) {
            // Handle errors
            set.status = 400;
            return { status: "error", message: err.message };
          }
        },
        {
          params: t.Object({
            userId: t.String(),
          }),
          detail: {
            tags: ["Wallet"],
            summary: "Get wallet balance for a user",
            description: "Retrieve the wallet balance for a specific user in Naira",
          },
        }
    )

    // Updated withdraw route that accepts bank details dynamically
    .post(
        "/wallet/withdraw",
        async ({ body, set }) => {
          try {
            const { userId, amount, bankDetails } = body;

            // Validate minimum withdrawal amount
            if (amount < 100) {
              set.status = 400;
              return { status: "error", message: "Minimum withdrawal amount is ₦100" };
            }

            // Call the new dynamic withdraw function
            const result = await withdrawToBank(userId, amount, bankDetails);

            return {
              status: "success",
              message: "Withdrawal initiated successfully",
              transferCode: result.data?.transfer_code,
              reference: result.data?.reference
            };
          } catch (err: any) {
            console.error('Withdrawal error:', err.message);

            // Handle specific error cases
            if (err.message.includes('Wallet not found')) {
              set.status = 404;
              return { status: "error", message: "Wallet not found for this user" };
            }

            if (err.message.includes('Insufficient balance')) {
              set.status = 400;
              return { status: "error", message: err.message };
            }

            if (err.message.includes('Invalid bank account')) {
              set.status = 400;
              return { status: "error", message: err.message };
            }

            set.status = 500;
            return { status: "error", message: err.message || "Withdrawal failed. Please try again." };
          }
        },
        {
          body: t.Object({
            userId: t.String(),
            amount: t.Number({ minimum: 100 }),
            bankDetails: t.Object({
              accountNumber: t.String(),
              bankCode: t.String(),
              accountName: t.Optional(t.String()) // Optional, we'll validate with Paystack
            })
          }),
          detail: {
            tags: ["Wallet"],
            summary: "Withdraw to specific bank account",
            description: "Withdraw funds to a specified bank account. Amount in Naira.",
          },
        }
    )

    // Alternative: Separate route for withdrawing to saved bank details
    .post(
        "/wallet/withdraw-saved",
        async ({ body, set }) => {
          try {
            const { userId, amount } = body;

            if (amount < 100) {
              set.status = 400;
              return { status: "error", message: "Minimum withdrawal amount is ₦100" };
            }

            // Use the original function for saved bank details
            const result = await withdrawFromWallet(userId, amount);

            return {
              status: "success",
              message: "Withdrawal initiated successfully",
              transferCode: result.data?.transfer_code,
              reference: result.data?.reference
            };
          } catch (err: any) {
            console.error('Withdrawal error:', err.message);
            set.status = 400;
            return { status: "error", message: err.message };
          }
        },
        {
          body: t.Object({
            userId: t.String(),
            amount: t.Number({ minimum: 100 }),
          }),
          detail: {
            tags: ["Wallet"],
            summary: "Withdraw to saved bank account",
            description: "Withdraw funds to user's saved bank account. Amount in Naira.",
          },
        }
    )

    // Add this route to get supported banks for the frontend
    .get(
        "/banks",
        async ({ set }) => {
          try {
            const banks = await getSupportedBanks();
            return banks;
          } catch (err: any) {
            set.status = 500;
            return { status: "error", message: "Unable to fetch banks list" };
          }
        },
        {
          detail: {
            tags: ["Utility"],
            summary: "Get supported banks",
            description: "Get list of banks supported by Paystack for transfers",
          },
        }
    );

async function resolveCheckoutUser(token?: string) {
  if (!token) {
    return null;
  }

  const { session, user } = await validateSessionToken(token);
  return session && user ? user : null;
}

function mergeOrderItems(items: { productId: string; quantity: number }[]) {
  const merged = new Map<string, { productId: string; quantity: number }>();

  for (const item of items) {
    const current = merged.get(item.productId);
    merged.set(item.productId, {
      productId: item.productId,
      quantity: (current?.quantity || 0) + item.quantity,
    });
  }

  return Array.from(merged.values());
}

function calculateMarketplaceFees(subtotalAmount: number, providerDeliveryFee: number) {
  const commissionAmount = roundMoney(subtotalAmount * config.PLATFORM_COMMISSION_RATE);
  const serviceFee = roundMoney((subtotalAmount * config.BUYER_SERVICE_FEE_RATE) + config.BUYER_SERVICE_FEE_NAIRA);
  const deliveryMarkup = roundMoney((providerDeliveryFee * config.DELIVERY_MARKUP_RATE) + config.DELIVERY_MARKUP_NAIRA);
  const deliveryFee = roundMoney(providerDeliveryFee + deliveryMarkup);
  const sellerPayoutAmount = roundMoney(subtotalAmount - commissionAmount);
  const platformRevenueAmount = roundMoney(commissionAmount + serviceFee + deliveryMarkup);
  const totalAmount = roundMoney(subtotalAmount + deliveryFee + serviceFee);

  return {
    commissionAmount,
    serviceFee,
    deliveryMarkup,
    deliveryFee,
    sellerPayoutAmount,
    platformRevenueAmount,
    totalAmount,
  };
}

function roundMoney(amount: number) {
  return Math.round(amount * 100) / 100;
}

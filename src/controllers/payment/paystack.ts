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

export const paystackRoutes = createBaseElysia()
export const walletRoutes = createBaseElysia()
export const orderRoutes = createBaseElysia()
    // Create order and initialize payment
    .post(
        "/orders/create",
        async ({ body, set }) => {
          try {
            const { buyerId, items, addressId, isBundle, callbackUrl: customCallbackUrl } = body;

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

            // Validate products and calculate total
            let totalAmount = 0;
            const validatedItems = [];

            for (const item of items) {
              const product = await db.product.findUnique({
                where: { id: item.productId },
              });

              if (!product) {
                set.status = 400;
                return {
                  status: "error",
                  message: `Product ${item.productId} not found`
                };
              }

              if (!product.isAvailable) {
                set.status = 400;
                return {
                  status: "error",
                  message: `Product "${product.title}" is no longer available`
                };
              }

              // Calculate price (apply discount if exists)
              let price = Number(product.basePrice);
              if (product.discountPercent) {
                price = price * (1 - product.discountPercent / 100);
              }

              totalAmount += price * item.quantity;
              validatedItems.push({
                productId: product.id,
                quantity: item.quantity,
                price: price,
              });
            }

            // Create the order
            const order = await db.order.create({
              data: {
                buyerId,
                addressId,
                isBundle,
                totalAmount,
                status: "PENDING",
                items: {
                  create: validatedItems,
                },
              },
              include: {
                items: {
                  include: {
                    product: true,
                  },
                },
              },
            });

            // Initialize payment with orderId in callback URL
            if (!customCallbackUrl) {
              set.status = 400;
              return {
                status: "error",
                message: "callbackUrl is required"
              };
            }

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

            return {
              status: "success",
              order: {
                id: order.id,
                totalAmount: Number(totalAmount),
                items: order.items,
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
            buyerId: t.String(),
            items: t.Array(
                t.Object({
                  productId: t.String(),
                  quantity: t.Number({ minimum: 1 }),
                })
            ),
            addressId: t.String(),
            isBundle: t.Optional(t.Boolean()),
            callbackUrl: t.Optional(t.String()),
          }),
          detail: {
            tags: ["Orders"],
            summary: "Create order and initialize payment",
            description: "Creates an order and returns Paystack payment URL",
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
            if (paidAmount !== Number(order.totalAmount)) {
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

              // Credit merchant wallets
              for (const item of order.items) {
                const merchantId = item.product.sellerId;
                const amountInKobo = nairaToKobo(
                    Number(item.price) * Number(item.quantity)
                );

                await tx.wallet.upsert({
                  where: { userId: merchantId },
                  update: { balance: { increment: amountInKobo } },
                  create: { userId: merchantId, balance: amountInKobo },
                });
              }

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
            });

            return {
              status: "success",
              message: "Payment verified and order completed",
              order: {
                id: order.id,
                status: "PROCESSING",
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

    // Withdraw from wallet
  .post(
    "/wallet/withdraw",
    async ({ body, set }) => {
      try {
        const { amount, userId } = body;
        await withdrawFromWallet(userId, amount);
        return { status: "success", message: "Withdrawal initiated" };
      } catch (err: any) {
        set.status = 400;
        return { status: "error", message: err.message };
      }
    },
    {
      body: t.Object({
        userId: t.String(), // Add userId to the request body
        amount: t.Number({ minimum: 100 }), // Minimum withdrawal amount in kobo
      }),
      detail: {
        tags: ["Wallet"],
        summary: "Withdraw from merchant wallet",
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

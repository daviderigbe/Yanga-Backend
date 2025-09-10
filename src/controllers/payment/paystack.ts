import { t } from "elysia";
import { createBaseElysia } from "../../base";
import { initializePayment, verifyPayment, verifyPaystackSignature, nairaToKobo,koboToNaira, creditMerchantWallet, withdrawFromWallet } from "../../services/paystack";

export const paystackRoutes = createBaseElysia()
export const walletRoutes = createBaseElysia()
  // Initialize payment
  .post(
    "/paystack/initialize",
    async ({ body, set }) => {
      try {
        const { email, amount, callback_url } = body;
        
        // Convert Naira to Kobo (multiply by 100)
        const amountInKobo = nairaToKobo(amount);
        
        const response = await initializePayment(
          email,
          amountInKobo, // properly converted
          callback_url
        );
        
        return response;
      } catch (err: any) {
        // Return proper error status and user-friendly messages
        if (err.message.includes('Invalid email')) {
          set.status = 400;
          return { status: "error", message: "Please provide a valid email address" };
        }
        if (err.message.includes('Amount')) {
          set.status = 400;
          return { status: "error", message: "Invalid amount. Amount must be at least ₦1" };
        }
        
        // Generic error for other cases
        set.status = 400;
        return { status: "error", message: err.message };
      }
    },
    {
      body: t.Object({
        email: t.String(),
        amount: t.Number({ minimum: 1 }), // Amount in Naira (will be converted to kobo)
        callback_url: t.Optional(t.String()),
      }),
      detail: {
        tags: ["Payment"],
        summary: "Initialize Paystack Payment",
        description: "Initialize payment. Amount should be in Naira (e.g., 1000 for ₦1,000)",
      },
    }
  )

  // Verify payment
  .get(
    "/paystack/verify/:reference",
    async ({ params, set }) => {
      try {
        const response = await verifyPayment(params.reference);
        return response;
      } catch (err: any) {
        // error handling
        if (err.message.includes('not found')) {
          set.status = 404;
          return { status: "error", message: "Payment reference not found" };
        }
        
        set.status = 400;
        return { status: "error", message: err.message };
      }
    },
    {
      params: t.Object({
        reference: t.String(),
      }),
      detail: {
        tags: ["Payment"],
        summary: "Verify Paystack Payment",
      },
    }
  )

    // Credit merchant wallet (admin or webhook use)
  .post(
    "/wallet/credit",
    async ({ body, set }) => {
      try {
        const { orderId, reference } = body;
        await creditMerchantWallet(orderId, reference);
        return { status: "success", message: "Wallet credited" };
      } catch (err: any) {
        set.status = 400;
        return { status: "error", message: err.message };
      }
    },
    {
      body: t.Object({
        orderId: t.String(),
        reference: t.String(),
      }),
      detail: {
        tags: ["Wallet"],
        summary: "Credit merchant wallet after payment",
      },
    }
  )

    // Withdraw from wallet
  .post(
    "/wallet/withdraw",
    async ({ body, set }) => {
      try {
        // You may want to get userId from auth middleware/session
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
  );
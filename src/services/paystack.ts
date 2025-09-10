import axios from "axios";
import crypto from "crypto";
import { db } from "../lib/db";
import { Prisma } from "@prisma/client";
import { config } from "../utils/config";

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

// Initialize payment
export async function initializePayment(
  email: string,
  amount: number,
  callback_url?: string
) {
try {
  const response = await axios.post(
    "https://api.paystack.co/transaction/initialize",
    {
      email,
      amount, // Amount should be in kobo (multiply by 100 if in naira)
      callback_url, // can be undefined
    },
    {
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
    }
  );
  return response.data;
}catch (error: any) {
    // Handle Paystack API errors properly
    if (error.response?.data) {
      const paystackError = error.response.data;
      throw new Error(paystackError.message || 'Payment initialization failed');
    }
    // Handle network/other errors
    throw new Error('Unable to connect to payment service. Please try again.');
  }
}

// Verify payment by reference
export async function verifyPayment(reference: string) {
try {
  const response = await axios.get(
    `https://api.paystack.co/transaction/verify/${reference}`,
    {
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
      },
    }
  );
  return response.data;
} catch (error: any) {
    // Handle Paystack API errors properly
    if (error.response?.data) {
      const paystackError = error.response.data;
      throw new Error(paystackError.message || 'Payment verification failed');
    }
    // Handle network/other errors
    throw new Error('Unable to verify payment. Please try again.');
  }
}

// Credit merchant wallet after payment verification
export async function creditMerchantWallet(orderId: string, reference: string) {
  const verification = await verifyPayment(reference);
  if (verification.status !== true || verification.data.status !== "success") {
    throw new Error("Payment not successful");
  }

  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { items: { include: { product: true } } },
  });
  if (!order) throw new Error("Order not found");

  for (const item of order.items) {
    const merchantId = item.product.sellerId;
    // Ensure price is in kobo (if price is Decimal, convert to number)
    const amount = Number(item.price) * Number(item.quantity);

    await db.wallet.upsert({
      where: { userId: merchantId },
      update: { balance: { increment: amount } },
      create: { userId: merchantId, balance: amount },
    });
  }
}

export async function withdrawFromWallet(userId: string, amount: number) {
  // 1. Check wallet balance
  const wallet = await db.wallet.findUnique({ where: { userId } });
  if (!wallet || wallet.balance < amount) throw new Error("Insufficient balance");

  // 2. Deduct from wallet
  await db.wallet.update({
    where: { userId },
    data: { balance: { decrement: amount } },
  });

  // 3. Initiate Paystack transfer (implement this)
  await initiatePaystackTransfer(userId, amount);
}

/**
 * Initiate a Paystack transfer to a merchant's bank account.
 * You must have created a transfer recipient for the merchant beforehand.
 */
export async function initiatePaystackTransfer(userId: string, amount: number) {
  // Fetch merchant bank details from your User table
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user || !user.bankCode || !user.bankAccountName) {
    throw new Error("Merchant bank details not found");
  }

  // You should store recipient_code in your DB after creating recipient with Paystack
  // For demo, let's assume you have a recipientCode field on User
  if (!user.recipientCode) {
    // Create recipient if not exists
    const recipientRes = await axios.post(
      "https://api.paystack.co/transferrecipient",
      {
        type: "nuban",
        name: user.bankAccountName,
        account_number: user.bankAccountNumber,
        bank_code: user.bankCode,
        currency: "NGN",
      },
      {
        headers: {
          Authorization: `Bearer ${config.PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );
    const recipientCode = recipientRes.data.data.recipient_code;
    // Save recipientCode to user (optional, for future transfers)
    await db.user.update({
      where: { id: userId },
      data: { recipientCode },
    });
    user.recipientCode = recipientCode;
  }

  // Initiate transfer
  const transferRes = await axios.post(
    "https://api.paystack.co/transfer",
    {
      source: "balance",
      amount,
      recipient: user.recipientCode,
      reason: "Merchant withdrawal",
    },
    {
      headers: {
        Authorization: `Bearer ${config.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
    }
  );
  return transferRes.data;
}

// Verify Paystack signature for webhook
export function verifyPaystackSignature(
  payload: string,
  signature?: string
): boolean {
  if (!signature) return false;
  const crypto = require("crypto");
  const hash = crypto
    .createHmac("sha512", PAYSTACK_SECRET_KEY)
    .update(payload)
    .digest("hex");
  return hash === signature;
}

export function nairaToKobo(naira: number): number {
  return Math.round(naira * 100);
}

export function koboToNaira(kobo: number): number {
  return kobo / 100;
}

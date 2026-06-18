import axios from "axios";
import crypto from "crypto";
import { db } from "../lib/db";
import { Prisma, WithdrawalStatus } from "@prisma/client";
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
        Authorization: `Bearer ${config.PAYSTACK_SECRET_KEY}`,
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
        Authorization: `Bearer ${config.PAYSTACK_SECRET_KEY}`,
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

/**
 * Fixed initiatePaystackTransfer function with proper error handling
 */
// Fixed withdrawFromWallet function with proper transaction handling
export async function withdrawFromWallet(userId: string, amountInNaira: number) {
    // Convert naira to kobo for internal calculations
    const amountInKobo = nairaToKobo(amountInNaira);

    // 1. Check wallet balance FIRST
    const wallet = await db.wallet.findUnique({ where: { userId } });
    if (!wallet) throw new Error("Wallet not found");
    if (wallet.balance < amountInKobo) {
        throw new Error(`Insufficient balance. Available: ₦${koboToNaira(wallet.balance)}, Requested: ₦${amountInNaira}`);
    }

    // 2. Validate bank details and initiate transfer BEFORE deducting money
    let transferResult;
    try {
        transferResult = await initiatePaystackTransfer(userId, amountInKobo);
    } catch (error: any) {
        // If transfer fails, don't deduct money - just throw the error
        throw new Error(error.message || 'Transfer validation failed');
    }

    const user = await db.user.findUnique({
        where: { id: userId },
        select: {
            bankCode: true,
            bankName: true,
            bankAccountName: true,
            bankAccountNumber: true,
            recipientCode: true,
        },
    });
    const transferData = transferResult.data || {};

    // 3. Only deduct from wallet AFTER successful transfer initiation, and keep a withdrawal record
    try {
        await db.$transaction(async (tx) => {
            await tx.wallet.update({
                where: { userId },
                data: { balance: { decrement: amountInKobo } },
            });

            await tx.withdrawal.create({
                data: {
                    userId,
                    amount: amountInKobo,
                    status: mapPaystackTransferStatus(transferData.status),
                    bankCode: user?.bankCode,
                    bankName: user?.bankName,
                    accountNumber: maskAccountNumber(user?.bankAccountNumber),
                    accountName: user?.bankAccountName,
                    recipientCode: user?.recipientCode || transferData.recipient || transferData.recipient_code,
                    transferCode: transferData.transfer_code,
                    reference: transferData.reference,
                    providerResponse: transferResult as Prisma.InputJsonValue,
                },
            });
        });
    } catch (error: any) {
        // If deduction fails after successful transfer, this is a critical error
        console.error('CRITICAL: Transfer initiated but wallet deduction failed', {
            userId,
            amountInKobo,
            transferResult,
            error: error.message
        });
        // You might want to send an alert here or add to a failed transactions table
        throw new Error('Transfer initiated but wallet update failed. Please contact support with this reference: ' + transferResult.data?.reference);
    }

    return transferResult;
}

/**
 * Updated initiatePaystackTransfer with better error handling
 */
export async function initiatePaystackTransfer(userId: string, amountInKobo: number) {
    try {
        console.log(`Starting transfer validation for user: ${userId}, amount: ${amountInKobo} kobo`);

        // Fetch user details
        const user = await db.user.findUnique({ where: { id: userId } });
        if (!user) {
            throw new Error("User not found");
        }

        console.log(`User bank details:`, {
            bankCode: user.bankCode ? 'Present' : 'Missing',
            bankAccountName: user.bankAccountName ? 'Present' : 'Missing',
            bankAccountNumber: user.bankAccountNumber ? 'Present' : 'Missing',
            recipientCode: user.recipientCode ? 'Present' : 'Missing'
        });

        if (!user.bankCode || !user.bankAccountName || !user.bankAccountNumber) {
            throw new Error("Incomplete bank details. Please update your bank information in your profile.");
        }

        let recipientCode = user.recipientCode;

        // Validate and create recipient if needed
        if (!recipientCode) {
            try {
                console.log('Validating bank account...');

                // Validate the bank account first
                const bankValidation = await validateBankAccount(user.bankAccountNumber, user.bankCode);
                console.log('Bank validation successful:', bankValidation.status);

                if (!bankValidation.status) {
                    throw new Error(`Invalid bank account: ${bankValidation.message}`);
                }

                // Use validated account name
                const validatedAccountName = bankValidation.data.account_name;
                console.log(`Account validated for: ${validatedAccountName}`);

                // Create recipient
                const recipientData = {
                    type: "nuban",
                    name: validatedAccountName,
                    account_number: user.bankAccountNumber,
                    bank_code: user.bankCode,
                    currency: "NGN",
                };

                const recipientRes = await axios.post(
                    "https://api.paystack.co/transferrecipient",
                    recipientData,
                    {
                        headers: {
                            Authorization: `Bearer ${config.PAYSTACK_SECRET_KEY}`,
                            "Content-Type": "application/json",
                        },
                    }
                );

                if (!recipientRes.data.status) {
                    throw new Error(recipientRes.data.message || 'Failed to create transfer recipient');
                }

                recipientCode = recipientRes.data.data.recipient_code;
                console.log(`Recipient created successfully`);

                // Save recipient code
                await db.user.update({
                    where: { id: userId },
                    data: { recipientCode },
                });

            } catch (error: any) {
                console.error('Bank validation/recipient creation failed:', error.message);

                // Provide more specific error messages
                if (error.response?.data) {
                    const paystackError = error.response.data;

                    if (paystackError.message?.includes('Could not resolve account name')) {
                        throw new Error('Invalid bank account number or bank code. Please verify your bank details.');
                    }
                    if (paystackError.message?.includes('Invalid bank code')) {
                        throw new Error('Invalid bank code. Please select the correct bank.');
                    }

                    throw new Error(`Bank validation failed: ${paystackError.message}`);
                }

                throw new Error('Unable to validate bank details. Please check your account number and bank selection.');
            }
        }

        // Initiate the actual transfer
        try {
            const transferData = {
                source: "balance",
                amount: amountInKobo,
                recipient: recipientCode,
                reason: "Merchant withdrawal",
            };

            const transferRes = await axios.post(
                "https://api.paystack.co/transfer",
                transferData,
                {
                    headers: {
                        Authorization: `Bearer ${config.PAYSTACK_SECRET_KEY}`,
                        "Content-Type": "application/json",
                    },
                }
            );

            console.log('Transfer initiated:', transferRes.data.status);

            if (!transferRes.data.status) {
                throw new Error(transferRes.data.message || 'Transfer initiation failed');
            }

            return transferRes.data;

        } catch (error: any) {
            console.error('Transfer initiation failed:', error.response?.data || error.message);

            if (error.response?.data) {
                const paystackError = error.response.data;

                // Handle invalid recipient by clearing stored code
                if (paystackError.message?.includes('Recipient specified is invalid')) {
                    console.log('Clearing invalid recipient code...');
                    await db.user.update({
                        where: { id: userId },
                        data: { recipientCode: null },
                    });
                    throw new Error('Bank details may have changed. Please try again.');
                }

                if (paystackError.message?.includes('Insufficient funds')) {
                    throw new Error('Merchant account has insufficient funds. Please contact support.');
                }

                throw new Error(`Transfer failed: ${paystackError.message}`);
            }

            throw new Error('Transfer service temporarily unavailable. Please try again later.');
        }

    } catch (error: any) {
        console.error('Transfer process failed:', error.message);
        throw error; // Re-throw to maintain error context
    }
}


export async function validateBankAccount(accountNumber: string, bankCode: string) {
    try {
        const response = await axios.get(
            `https://api.paystack.co/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`,
            {
                headers: {
                    Authorization: `Bearer ${config.PAYSTACK_SECRET_KEY}`,
                },
            }
        );
        return response.data;
    } catch (error: any) {
        if (error.response?.data) {
            throw new Error(error.response.data.message || 'Bank account validation failed');
        }
        throw new Error('Unable to validate bank account');
    }
}

// New function for dynamic bank details withdrawal
export async function withdrawToBank(
    userId: string,
    amountInNaira: number,
    bankDetails: {
        accountNumber: string;
        bankCode: string;
        accountName?: string;
        bankName?: string;
    }
) {
    const amountInKobo = nairaToKobo(amountInNaira);

    // 1. Check wallet balance
    const wallet = await db.wallet.findUnique({ where: { userId } });
    if (!wallet) throw new Error("Wallet not found");
    if (wallet.balance < amountInKobo) {
        throw new Error(`Insufficient balance. Available: ₦${koboToNaira(wallet.balance)}, Requested: ₦${amountInNaira}`);
    }

    // 2. Validate bank account and create transfer recipient
    let transferResult;
    try {
        transferResult = await initiateTransferToBank(userId, amountInKobo, bankDetails);
    } catch (error: any) {
        throw new Error(error.message || 'Transfer validation failed');
    }

    const transferData = transferResult.data || {};

    // 3. Deduct from wallet only after successful transfer initiation, and keep a withdrawal record
    try {
        await db.$transaction(async (tx) => {
            await tx.wallet.update({
                where: { userId },
                data: { balance: { decrement: amountInKobo } },
            });

            await tx.withdrawal.create({
                data: {
                    userId,
                    amount: amountInKobo,
                    status: mapPaystackTransferStatus(transferData.status),
                    bankCode: bankDetails.bankCode,
                    bankName: bankDetails.bankName,
                    accountNumber: maskAccountNumber(bankDetails.accountNumber),
                    accountName: bankDetails.accountName,
                    recipientCode: transferData.recipient || transferData.recipient_code,
                    transferCode: transferData.transfer_code,
                    reference: transferData.reference,
                    providerResponse: transferResult as Prisma.InputJsonValue,
                },
            });
        });
    } catch (error: any) {
        console.error('CRITICAL: Transfer initiated but wallet deduction failed', {
            userId,
            amountInKobo,
            transferResult,
            error: error.message
        });
        throw new Error('Transfer initiated but wallet update failed. Reference: ' + transferResult.data?.reference);
    }

    return transferResult;
}

// Function to handle dynamic bank account transfers
export async function initiateTransferToBank(
    userId: string,
    amountInKobo: number,
    bankDetails: {
        accountNumber: string;
        bankCode: string;
        accountName?: string;
        bankName?: string;
    }
) {
    try {
        console.log(`Validating bank account: ${bankDetails.accountNumber} - ${bankDetails.bankCode}`);

        // 1. Validate the bank account
        const bankValidation = await validateBankAccount(bankDetails.accountNumber, bankDetails.bankCode);

        if (!bankValidation.status) {
            throw new Error(`Invalid bank account: ${bankValidation.message}`);
        }

        // 2. Use the validated account name from Paystack
        const validatedAccountName = bankValidation.data.account_name;
        console.log(`Account validated for: ${validatedAccountName}`);

        // 3. Create a temporary recipient (don't save to user profile)
        const recipientData = {
            type: "nuban",
            name: validatedAccountName,
            account_number: bankDetails.accountNumber,
            bank_code: bankDetails.bankCode,
            currency: "NGN",
        };

        const recipientRes = await axios.post(
            "https://api.paystack.co/transferrecipient",
            recipientData,
            {
                headers: {
                    Authorization: `Bearer ${config.PAYSTACK_SECRET_KEY}`,
                    "Content-Type": "application/json",
                },
            }
        );

        if (!recipientRes.data.status) {
            throw new Error(recipientRes.data.message || 'Failed to create transfer recipient');
        }

        const recipientCode = recipientRes.data.data.recipient_code;
        console.log(`Temporary recipient created`);

        // 4. Initiate transfer
        const transferData = {
            source: "balance",
            amount: amountInKobo,
            recipient: recipientCode,
            reason: `Withdrawal by user ${userId}`,
        };

        const transferRes = await axios.post(
            "https://api.paystack.co/transfer",
            transferData,
            {
                headers: {
                    Authorization: `Bearer ${config.PAYSTACK_SECRET_KEY}`,
                    "Content-Type": "application/json",
                },
            }
        );

        if (!transferRes.data.status) {
            throw new Error(transferRes.data.message || 'Transfer initiation failed');
        }

        // 5. Optionally save this bank account for future use if user wants
        // (You could add a flag in the request to save it)

        return transferRes.data;

    } catch (error: any) {
        console.error('Dynamic transfer failed:', error.message);

        if (error.response?.data) {
            const paystackError = error.response.data;

            if (paystackError.message?.includes('Could not resolve account name')) {
                throw new Error('Invalid bank account number. Please check and try again.');
            }
            if (paystackError.message?.includes('Invalid bank code')) {
                throw new Error('Invalid bank selected. Please choose the correct bank.');
            }
            if (paystackError.message?.includes('Insufficient funds')) {
                throw new Error('Service temporarily unavailable. Please try again later.');
            }

            throw new Error(`Bank validation failed: ${paystackError.message}`);
        }

        throw error;
    }
}

// Helper function to get list of supported banks
export async function getSupportedBanks() {
    try {
        const response = await axios.get(
            "https://api.paystack.co/bank",
            {
                headers: {
                    Authorization: `Bearer ${config.PAYSTACK_SECRET_KEY}`,
                },
            }
        );
        return response.data;
    } catch (error: any) {
        throw new Error('Unable to fetch supported banks');
    }
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

function mapPaystackTransferStatus(status?: string | null): WithdrawalStatus {
    switch ((status || "").toLowerCase()) {
        case "success":
            return WithdrawalStatus.SUCCESS;
        case "failed":
            return WithdrawalStatus.FAILED;
        case "reversed":
            return WithdrawalStatus.REVERSED;
        case "pending":
        case "otp":
        case "queued":
            return WithdrawalStatus.PROCESSING;
        default:
            return WithdrawalStatus.PROCESSING;
    }
}

function maskAccountNumber(accountNumber?: string | null): string | undefined {
    if (!accountNumber) return undefined;
    return `****${accountNumber.slice(-4)}`;
}

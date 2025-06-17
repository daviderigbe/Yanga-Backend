import { t } from "elysia";
import { createBaseElysia } from "../../base";
import { validateSessionToken } from "../../lib/auth";
import { db } from "../../lib/db";

export const changeBankDetails = createBaseElysia().post(
  "/bank-details",
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

      // Update user's bank details
      const updatedUser = await db.user.update({
        where: { id: user.id },
        data: {
          bankName: body.bankName,
          bankCode: body.accountNumber,
          bankAccountName: body.accountName,
          updatedAt: new Date(),
        },
        select: {
          id: true,
          bankName: true,
          bankCode: true,
          bankAccountName: true,
          updatedAt: true,
        },
      });

      set.status = "OK";
      return {
        status: "success",
        message: "Bank details updated successfully",
        data: updatedUser,
      };
    } catch (error) {
      log.error("Bank details update error:", error);
      set.status = 500;
      return {
        status: "error",
        message: "An error occurred while updating bank details",
      };
    }
  },
  {
    body: t.Object({
      bankName: t.String({
        minLength: 2,
        maxLength: 100,
        error: "Bank name must be between 2 and 100 characters",
      }),
      accountNumber: t.String({
        minLength: 10,
        maxLength: 12,
        pattern: "^[0-9]+$",
        error: "Account number must be 10-12 digits",
      }),
      accountName: t.String({
        minLength: 2,
        maxLength: 100,
        error: "Account name must be between 2 and 100 characters",
      }),
    }),
    detail: {
      tags: ["Users"],
      summary: "Add/Update bank details",
      description: "Add or update user's bank account details",
    },
  },
);

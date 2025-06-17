import { createBaseElysia } from "../../base";
import { validateSessionToken } from "../../lib/auth";
import { db } from "../../lib/db";

export const fetchBankDetails = createBaseElysia().get(
  "/bank-details",
  async ({ set, log, cookie: { session } }) => {
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

      const bankDetails = await db.user.findUnique({
        where: { id: user.id },
        select: {
          bankName: true,
          bankCode: true,
          bankAccountName: true,
        },
      });

      set.status = "OK";
      return {
        status: "success",
        message: "Bank details retrieved successfully",
        data: bankDetails,
      };
    } catch (error) {
      log.error("Get bank details error:", error);
      set.status = 500;
      return {
        status: "error",
        message: "An error occurred while retrieving bank details",
      };
    }
  },
  {
    detail: {
      tags: ["Users"],
      summary: "Get bank details",
      description: "Retrieve user's bank account details",
    },
  },
);

import { t } from "elysia";
import { createBaseElysia } from "../../base";
import { db } from "../../lib/db";
import { randomBytes } from "crypto";
import { sendEmail } from "../../lib/email";
import { redisClient } from "../../lib/redis";

// Define an interface for the email verification data
interface EmailVerificationData {
  code: string;
  userId: string;
  email: string;
}

export const emailVerificationRoutes = createBaseElysia({
  prefix: "/email-verification",
})
  // Step 1: Send verification code to email
  .post(
    "/send-code",
    async ({ body, log, set }) => {
      try {
        const email = body.email.toLowerCase().trim();

        // Check if user exists
        const user = await db.user.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
            emailVerified: true,
          },
        });

        if (!user) {
          set.status = 404;
          return {
            status: "error",
            message: "User not found",
          };
        }

        if (user.emailVerified) {
          set.status = 400;
          return {
            status: "error",
            message: "Email is already verified",
          };
        }

        // Generate verification code (6 digits)
        const code = randomBytes(3)
          .toString("hex")
          .substring(0, 6)
          .toUpperCase();

        // Store code in Redis with 15 minute expiration
        const redisKey = `email_verification:${email}`;
        const verificationData: EmailVerificationData = {
          code,
          userId: user.id,
          email: user.email,
        };

        await redisClient.set(redisKey, JSON.stringify(verificationData), {
          EX: 15 * 60, // 15 minutes TTL
        });

        // Send verification code via email
        await sendEmail({
          to: email,
          subject: "Email Verification Code",
          body: `Your email verification code is: ${code}. It will expire in 15 minutes.`,
        });

        set.status = 200;
        return {
          status: "success",
          message: "Verification code sent to your email",
        };
      } catch (error) {
        log.error("Send verification code error:", error);
        set.status = 500;
        return {
          status: "error",
          message: "Failed to send verification code",
        };
      }
    },
    {
      body: t.Object({
        email: t.String({ format: "email" }),
      }),
      response: t.Object({
        status: t.Enum({ success: "success", error: "error" }),
        message: t.String(),
      }),
      detail: {
        tags: ["Auth"],
        summary: "Send email verification code",
        description: "Send a verification code to the user's email address",
      },
    },
  )

  // Step 2: Verify email with code
  .post(
    "/verify",
    async ({ body, log, set }) => {
      try {
        const email = body.email.toLowerCase().trim();
        const code = body.code.trim().toUpperCase();
        const redisKey = `email_verification:${email}`;

        // Get verification data from Redis
        const storedData = await redisClient.get(redisKey);

        if (!storedData) {
          set.status = 400;
          return {
            status: "error",
            message: "No verification code found or code has expired",
          };
        }

        const verification: EmailVerificationData = JSON.parse(storedData);

        if (verification.code !== code) {
          set.status = 400;
          return {
            status: "error",
            message: "Invalid verification code",
          };
        }

        // Update user's email verification status
        await db.user.update({
          where: { id: verification.userId },
          data: { emailVerified: true },
        });

        // Delete verification code from Redis
        await redisClient.del(redisKey);

        set.status = 200;
        return {
          status: "success",
          message: "Email verified successfully",
        };
      } catch (error) {
        log.error("Email verification error:", error);
        set.status = 500;
        return {
          status: "error",
          message: "Failed to verify email",
        };
      }
    },
    {
      body: t.Object({
        email: t.String({ format: "email" }),
        code: t.String(),
      }),
      response: t.Object({
        status: t.Enum({ success: "success", error: "error" }),
        message: t.String(),
      }),
      detail: {
        tags: ["Auth"],
        summary: "Verify email with code",
        description:
          "Verify the user's email address using the sent verification code",
      },
    },
  )

  // Step 3: Resend verification code
  .post(
    "/resend-code",
    async ({ body, log, set }) => {
      try {
        const email = body.email.toLowerCase().trim();

        // Check if user exists and is not verified
        const user = await db.user.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
            emailVerified: true,
          },
        });

        if (!user) {
          set.status = 404;
          return {
            status: "error",
            message: "User not found",
          };
        }

        if (user.emailVerified) {
          set.status = 400;
          return {
            status: "error",
            message: "Email is already verified",
          };
        }

        // Generate new verification code
        const code = randomBytes(3)
          .toString("hex")
          .substring(0, 6)
          .toUpperCase();

        // Store new code in Redis, overwriting any existing code
        const redisKey = `email_verification:${email}`;
        const verificationData: EmailVerificationData = {
          code,
          userId: user.id,
          email: user.email,
        };

        await redisClient.set(redisKey, JSON.stringify(verificationData), {
          EX: 15 * 60, // 15 minutes TTL
        });

        // Send new verification code via email
        await sendEmail({
          to: email,
          subject: "New Email Verification Code",
          body: `Your new email verification code is: ${code}. It will expire in 15 minutes.`,
        });

        set.status = 200;
        return {
          status: "success",
          message: "New verification code sent to your email",
        };
      } catch (error) {
        log.error("Resend verification code error:", error);
        set.status = 500;
        return {
          status: "error",
          message: "Failed to resend verification code",
        };
      }
    },
    {
      body: t.Object({
        email: t.String({ format: "email" }),
      }),
      response: t.Object({
        status: t.Enum({ success: "success", error: "error" }),
        message: t.String(),
      }),
      detail: {
        tags: ["Auth"],
        summary: "Resend email verification code",
        description:
          "Resend a new verification code to the user's email address",
      },
    },
  );

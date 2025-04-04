import { t } from "elysia";
import { createBaseElysia } from "../../base";
import { db } from "../../lib/db";
import { randomBytes } from "crypto";
import { sendEmail } from "../../lib/email";
import { createClient } from "redis";

// Define an interface for the verification data
interface VerificationData {
  code: string;
  verified: boolean;
  userId: string;
}

// Create Redis client
const redisClient = createClient({
  username: "default",
  password: Bun.env.REDIS_PASSWORD as string,
  socket: {
    host: Bun.env.REDIS_HOST as string,
    port: 12822,
  },
});

// Connect to Redis
(async () => {
  redisClient.on("error", (err) => console.error("Redis Client Error:", err));
  await redisClient.connect();
})();

export const forgotPasswordRoutes = createBaseElysia({ prefix: "/password" })
  // Step 1: Request password reset
  .post(
    "/request-reset",
    async ({ body, log, set }) => {
      try {
        const { email } = body;

        // Check if user exists
        const user = await db.user.findUnique({
          where: { email },
        });

        if (!user) {
          // Don't reveal if email exists or not (security)
          set.status = "OK";
          return {
            status: "success",
            message:
              "If your email exists in our system, you will receive a verification code",
          };
        }

        // Generate verification code (6 digits)
        const code = randomBytes(3)
          .toString("hex")
          .substring(0, 6)
          .toUpperCase();

        // Store code in Redis with 15 minute expiration
        const redisKey = `password_reset:${email}`;
        const verificationData: VerificationData = {
          code,
          verified: false,
          userId: user.id,
        };

        // Use string serialization as a fallback
        await redisClient.set(redisKey, JSON.stringify(verificationData), {
          EX: 15 * 60, // 15 minutes TTL
        });

        // Send verification code via email
        await sendEmail({
          to: email,
          subject: "Password Reset Verification Code",
          body: `Your verification code is: ${code}. It will expire in 15 minutes.`,
        });

        set.status = "OK";
        return {
          status: "success",
          message:
            "If your email exists in our system, you will receive a verification code",
        };
      } catch (error) {
        log.error(error);
        set.status = 500;
        return {
          status: "error",
          message: "Failed to process password reset request",
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
        summary: "Request password reset (Forgot password)",
        description:
          "Request a password reset and receive a verification code via email",
      },
    },
  )

  // Step 2: Verify code
  .post(
    "/verify-code",
    async ({ body, log, set }) => {
      try {
        const { email, code } = body;
        const redisKey = `password_reset:${email}`;

        // Get verification data from Redis
        const storedData = await redisClient.get(redisKey);

        if (!storedData) {
          set.status = 400;
          return {
            status: "error",
            message: "No verification code found",
          };
        }

        const verification: VerificationData = JSON.parse(storedData);

        if (verification.code !== code) {
          set.status = 400;
          return {
            status: "error",
            message: "Invalid verification code",
          };
        }

        // Mark as verified
        const updatedVerification: VerificationData = {
          ...verification,
          verified: true,
        };

        await redisClient.set(redisKey, JSON.stringify(updatedVerification), {
          EX: 15 * 60, // Maintain existing expiration
        });

        set.status = "OK";
        return {
          status: "success",
          message: "Verification code is valid",
        };
      } catch (error) {
        log.error(error);
        set.status = 500;
        return {
          status: "error",
          message: "Failed to verify code",
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
        summary: "Verify reset code",
        description: "Verify the password reset code sent to the user's email",
      },
    },
  )

  // Step 3: Reset password
  .post(
    "/reset",
    async ({ body, log, set }) => {
      try {
        const { email, code, newPassword } = body;
        const redisKey = `password_reset:${email}`;

        // Get verification data from Redis
        const storedData = await redisClient.get(redisKey);

        if (!storedData) {
          set.status = 400;
          return {
            status: "error",
            message: "No verification code found",
          };
        }

        const verification: VerificationData = JSON.parse(storedData);

        if (verification.code !== code || !verification.verified) {
          set.status = 400;
          return {
            status: "error",
            message: "Invalid or unverified reset code",
          };
        }

        // Hash the new password
        const hashedPassword = await Bun.password.hash(newPassword);

        // Update user's password
        await db.user.update({
          where: { id: verification.userId },
          data: { password: hashedPassword },
        });

        // Delete verification code from Redis
        await redisClient.del(redisKey);

        set.status = "OK";
        return {
          status: "success",
          message: "Password has been reset successfully",
        };
      } catch (error) {
        log.error(error);
        set.status = 500;
        return {
          status: "error",
          message: "Failed to reset password",
        };
      }
    },
    {
      body: t.Object({
        email: t.String({ format: "email" }),
        code: t.String(),
        newPassword: t.String({ minLength: 8 }),
      }),
      response: t.Object({
        status: t.Enum({ success: "success", error: "error" }),
        message: t.String(),
      }),
      detail: {
        tags: ["Auth"],
        summary: "Reset password",
        description: "Reset password with verification code and new password",
      },
    },
  );

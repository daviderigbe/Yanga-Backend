import { createBaseElysia } from "../../base";
import { db } from "../../lib/db";
import {
  createSession,
  generateSessionToken,
  setSessionTokenCookie,
} from "../../lib/auth";
import { t } from "elysia";
import { OAuth2Client } from "google-auth-library";
import { config } from "../../utils/config";

// Initialize Google OAuth2 client for token verification
// Accept tokens from web, Android, and iOS clients
const googleClient = new OAuth2Client();
const validAudiences = [
  config.GOOGLE_CLIENT_ID, // Web client ID
  config.GOOGLE_ANDROID_CLIENT_ID, // Android client ID (optional)
  config.GOOGLE_IOS_CLIENT_ID, // iOS client ID (optional)
].filter(Boolean); // Remove undefined values

/**
 * Mobile OAuth endpoint that verifies ID tokens from mobile apps
 */
export const mobileAuth = createBaseElysia().post(
  "/mobile/:provider",
  async ({
    params: { provider },
    body: { idToken, accessToken },
    cookie: { session },
    set,
    log,
  }) => {
    try {
      let userInfo;

      if (provider === "google") {
        // Verify the ID token with Google
        const ticket = await googleClient.verifyIdToken({
          idToken: idToken,
          audience: validAudiences,
        });

        const payload = ticket.getPayload();
        if (!payload || !payload.email || !payload.name) {
          set.status = "Bad Request";
          return { message: "Invalid token payload" };
        }

        userInfo = {
          id: payload.sub,
          email: payload.email,
          name: payload.name,
          picture: payload.picture || "",
          emailVerified: payload.email_verified || false,
        };
      } else {
        set.status = "Bad Request";
        return { message: "Unsupported provider" };
      }

      // Look up existing user by email
      const existingUser = await db.user.findUnique({
        where: {
          email: userInfo.email,
        },
      });

      let userId: string;

      if (existingUser) {
        // User already exists - update provider ID if needed
        userId = existingUser.id;

        if (provider === "google" && !existingUser.googleId) {
          await db.user.update({
            where: { id: userId },
            data: {
              googleId: userInfo.id,
              emailVerified:
                userInfo.emailVerified || existingUser.emailVerified,
            },
          });
        }
      } else {
        // Create new user
        userId = crypto.randomUUID();

        const userData: any = {
          id: userId,
          email: userInfo.email,
          emailVerified: userInfo.emailVerified,
          name: userInfo.name,
          imageUrl: userInfo.picture,
        };

        // Set provider-specific ID
        if (provider === "google") {
          userData.googleId = userInfo.id;
        }

        // Create the user
        await db.user.create({ data: userData });

        // Create a cart for the new user
        await db.cart.create({
          data: { userId },
        });
      }

      // Create session
      const token = generateSessionToken();
      const dbSession = await createSession(token, userId);
      setSessionTokenCookie(session, token, dbSession.expiresAt);

      // Return session info for mobile app
      return {
        success: true,
        sessionToken: token,
        expiresAt: dbSession.expiresAt.toISOString(),
        user: {
          id: userId,
          email: userInfo.email,
          name: userInfo.name,
          imageUrl: userInfo.picture,
        },
      };
    } catch (error) {
      log.error(`Mobile OAuth error: ${error}`);
      set.status = "Internal Server Error";
      return {
        success: false,
        message: "Authentication failed",
      };
    }
  },
  {
    body: t.Object({
      idToken: t.String(),
      accessToken: t.Optional(t.String()),
    }),
    params: t.Object({
      provider: t.Union([t.Literal("google"), t.Literal("apple")]),
    }),
    detail: {
      tags: ["Auth"],
      summary: "Mobile OAuth authentication",
      description:
        "Authenticates mobile users using ID tokens from native OAuth flows",
    },
  },
);

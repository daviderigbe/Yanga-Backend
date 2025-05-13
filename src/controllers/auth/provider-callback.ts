import { getAuthAccount, getTokens } from "../../lib/google";
import { db } from "../../lib/db";
import {
  createSession,
  generateSessionToken,
  setSessionTokenCookie,
} from "../../lib/auth";
import { OAuth2RequestError } from "arctic";
import { t } from "elysia";
import { createBaseElysia } from "../../base";
import type { AuthProvider } from "../../lib/auth-types";

/**
 * OAuth callback endpoint that handles the response from OAuth providers.
 * Creates or updates user accounts and establishes sessions.
 */
export const providerCallback = createBaseElysia().get(
  "/:provider/callback",
  async ({
    query: { code, state },
    cookie,
    params: { provider },
    set,
    log,
    redirect,
  }) => {
    const { oauth_state, oauth_code_verifier, oauth_next, session } = cookie;
    const next = oauth_next?.value ?? "/";
    const storedState = oauth_state?.value;
    const storedCodeVerifier = oauth_code_verifier?.value;

    // Validate state parameter to prevent CSRF attacks
    if (!storedState || !storedCodeVerifier || state !== storedState) {
      log.error(`State mismatch: received=${state}, stored=${storedState}`);
      set.status = "Bad Request";
      return {
        message: "Authentication failed - invalid state parameter",
      };
    }

    try {
      // Exchange authorization code for tokens
      const tokens = await getTokens(
        provider as AuthProvider,
        code,
        storedCodeVerifier,
      );

      // Get user information from provider
      const account = await getAuthAccount(
        provider as AuthProvider,
        tokens.accessToken(),
      );

      console.log(account);

      // Look up existing user by email
      const existingUser = await db.user.findUnique({
        where: {
          email: account.email,
        },
      });

      let userId: string;

      if (existingUser) {
        // User already exists - update provider ID if needed
        userId = existingUser.id;

        // Update provider-specific fields if not already set
        if (provider === "google" && !existingUser.googleId) {
          await db.user.update({
            where: { id: userId },
            data: { googleId: account.id },
          });
        } else if (provider === "apple" && !existingUser.appleId) {
          await db.user.update({
            where: { id: userId },
            data: { appleId: account.id },
          });
        }
      } else {
        // Create new user
        userId = crypto.randomUUID();

        // Basic user data
        const userData: any = {
          id: userId,
          email: account.email,
          emailVerified: true, // Email is verified by provider
          name: account.username,
          imageUrl: account.iconUrl,
        };

        // Set provider-specific ID
        if (provider === "google") {
          userData.googleId = account.id;
        } else if (provider === "apple") {
          userData.appleId = account.id;
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

      // Set session cookie
      setSessionTokenCookie(session, token, dbSession.expiresAt);

      // Clear OAuth cookies
      for (const cookieName of [
        "oauth_state",
        "oauth_code_verifier",
        "oauth_next",
      ]) {
        cookie[cookieName]?.set({
          value: "",
          maxAge: 0,
          path: "/",
        });
      }

      // Redirect to final destination - using the new redirect method
      return redirect(next);
    } catch (error) {
      if (error instanceof OAuth2RequestError) {
        log.error(`OAuth request error: ${error.message}`);
        set.status = "Bad Request";
        return {
          message: "Authentication failed with the provider",
        };
      }

      log.error(`OAuth callback error: ${error}`);
      set.status = "Internal Server Error";
      return {
        message: "An error occurred during authentication",
      };
    }
  },
  {
    query: t.Object(
      {
        code: t.String(),
        state: t.String(),
      },
      { additionalProperties: true },
    ),
    params: t.Object({
      provider: t.Union([t.Literal("google"), t.Literal("apple")]),
    }),
    detail: {
      tags: ["Auth"],
      summary: "OAuth callback endpoint",
      description:
        "Handles response from OAuth provider and authenticates user",
    },
  },
);

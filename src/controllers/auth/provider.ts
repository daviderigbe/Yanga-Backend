import { genAuthUrl } from "../../lib/google";
import { generateCodeVerifier, generateState } from "arctic";
import { t } from "elysia";
import { createBaseElysia } from "../../base";
import { config } from "../../utils/config";

/**
 * OAuth provider endpoint that initiates the authentication flow.
 * Redirects users to the Google login page.
 */
export const provider = createBaseElysia().get(
  "/:provider",
  async ({
    params: { provider },
    query: { next },
    cookie: { oauth_state, oauth_code_verifier, oauth_next },
    redirect,
  }) => {
    // Generate PKCE and state values
    const state = generateState();
    const codeVerifier = generateCodeVerifier();

    // Generate authorization URL based on provider
    const redirectUrl = await genAuthUrl(provider, state, codeVerifier);

    // Environment-specific settings
    const isProduction = config.NODE_ENV === "production";

    // Store auth state in cookies
    oauth_state?.set({
      value: state,
      path: "/",
      secure: isProduction,
      httpOnly: true,
      sameSite: isProduction ? "none" : "lax",
      maxAge: 60 * 10, // 10 minutes
    });

    oauth_code_verifier?.set({
      value: codeVerifier,
      path: "/",
      secure: isProduction,
      httpOnly: true,
      sameSite: isProduction ? "none" : "lax",
      maxAge: 60 * 10, // 10 minutes
    });

    oauth_next?.set({
      value: next ?? "/",
      path: "/",
      secure: isProduction,
      httpOnly: true,
      sameSite: isProduction ? "none" : "lax",
      maxAge: 60 * 10, // 10 minutes
    });

    // Redirect to provider authentication page using the new redirect method
    return redirect(redirectUrl.toString());
  },
  {
    query: t.Object({
      next: t.Optional(t.String()),
    }),
    params: t.Object({
      provider: t.Union([t.Literal("google"), t.Literal("apple")]),
    }),
    detail: {
      tags: ["Auth"],
      summary: "OAuth provider login",
      description: "Redirects user to OAuth provider login screen",
    },
  },
);

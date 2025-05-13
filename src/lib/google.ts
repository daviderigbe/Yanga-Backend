import { Google as GoogleInstance } from "arctic";
import { config } from "../utils/config";
import {
  AuthProvider,
  BaseAuthAccountInfo,
  openIdConnectUserInfo,
} from "./auth-types";

// Generate google oauth2 client
const googleClient = new GoogleInstance(
  config.GOOGLE_CLIENT_ID,
  config.GOOGLE_CLIENT_SECRET,
  `${config.APP_URL}/auth/google/callback`,
);

// Generate google oauth url
const googleAuthUrl = async (state: string, codeVerifier: string) => {
  return googleClient.createAuthorizationURL(state, codeVerifier, [
    "profile",
    "email",
  ]);
};

// Validate code and exchange for tokens
const getGoogleTokens = async (code: string, codeVerifier: string) => {
  const tokens = await googleClient.validateAuthorizationCode(
    code,
    codeVerifier,
  );
  console.log(tokens);
  return tokens;
};

const getGoogleAccount = async (
  accessToken: string,
): Promise<BaseAuthAccountInfo> => {
  const response = await fetch(
    "https://openidconnect.googleapis.com/v1/userinfo",
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );
  const user: GoogleResponse = await response.json();

  if (!user || !user.email || !user.name) {
    throw new Error("Invalid user information from google");
  }

  return {
    id: user.sub,
    username: user.name,
    email: user.email,
    iconUrl: user.picture || "",
  };
};

//GEnerate auth url for provider
export const genAuthUrl = (
  provider: AuthProvider,
  state: string,
  codeVerifier: string,
) => {
  switch (provider) {
    case "google":
      return googleAuthUrl(state, codeVerifier);
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
};

// Gets authentication tokens for the specified provider
export const getTokens = async (
  provider: AuthProvider,
  code: string,
  codeVerifier: string,
) => {
  switch (provider) {
    case "google":
      return await getGoogleTokens(code, codeVerifier);
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
};

// Gets user account information from the specified provider
export const getAuthAccount = async (
  provider: AuthProvider,
  accessToken: string,
) => {
  switch (provider) {
    case "google":
      return await getGoogleAccount(accessToken);
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
};

type GoogleResponse = openIdConnectUserInfo;
export type { GoogleResponse };

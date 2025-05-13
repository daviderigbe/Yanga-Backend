/**
 * Supported authentication providers
 */
export type AuthProvider = "google" | "apple"; // Can be expanded to include more providers

/**
 * Base authentication account information returned by providers
 */
export type BaseAuthAccountInfo = {
  id: string; // Provider-specific user ID
  username: string; // User's display name
  email: string; // User's email address
  iconUrl: string; // User's profile picture URL
};

/**
 * OpenID Connect standard claims
 * Ref: https://openid.net/specs/openid-connect-core-1_0.html#StandardClaims
 */
export type openIdConnectUserInfo = {
  sub: string; // Subject - Identifier for the End-User at the Issuer
  name?: string; // End-User's full name
  given_name?: string; // First name
  family_name?: string; // Last name
  middle_name?: string; // Middle name
  nickname?: string; // Casual name
  preferred_username?: string; // Preferred username
  profile?: string; // URL of profile page
  picture?: string; // URL of profile picture
  website?: string; // URL of web page or blog
  email?: string; // Email address
  email_verified?: boolean; // Whether email has been verified
  gender?: string; // Gender
  birthdate?: string; // Birthday in YYYY-MM-DD format
  zoneinfo?: string; // Time zone
  locale?: string; // Locale as BCP47 language tag
  phone_number?: string; // Phone number
  phone_number_verified?: boolean; // Whether phone number has been verified
  address?: {
    formatted?: string; // Full mailing address
    street_address?: string; // Street address
    locality?: string; // City or locality
    region?: string; // State, province, or region
    postal_code?: string; // Zip or postal code
    country?: string; // Country
  };
  updated_at?: number; // Last update time (seconds since Unix epoch)
};

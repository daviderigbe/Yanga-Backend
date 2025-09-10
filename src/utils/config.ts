export const config = {
  PORT: Bun.env.PORT || 8000,
  NODE_ENV: Bun.env.NODE_ENV || "development",
  GOOGLE_CLIENT_ID: Bun.env.GOOGLE_CLIENT_ID || "",
  GOOGLE_CLIENT_SECRET: Bun.env.GOOGLE_CLIENT_SECRET || "",
  GOOGLE_IOS_CLIENT_ID: Bun.env.GOOGLE_IOS_CLIENT_ID || "",
  GOOGLE_ANDROID_CLIENT_ID: Bun.env.GOOGLE_ANDROID_CLIENT_ID || "",
  APP_URL: Bun.env.APP_URL || "",
  PAYSTACK_SECRET_KEY: Bun.env.PAYSTACK_SECRET_KEY || "sk_test_42c1977eb5b329119ed784f9919689b112fafb51",
  PAYSTACK_BASE_URL: Bun.env.PAYSTACK_BASE_URL || "https://api.paystack.co"
};

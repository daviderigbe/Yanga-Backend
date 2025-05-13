export const config = {
  PORT: Bun.env.PORT || 8000,
  NODE_ENV: Bun.env.NODE_ENV || "development",
  GOOGLE_CLIENT_ID: Bun.env.GOOGLE_CLIENT_ID || "",
  GOOGLE_CLIENT_SECRET: Bun.env.GOOGLE_CLIENT_SECRET || "",
  APP_URL: Bun.env.APP_URL || "",
};

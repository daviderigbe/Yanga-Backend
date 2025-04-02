import { createClient } from "redis";

export const redisClient = createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379",
});

// Set up error handling
redisClient.on("error", (err) => {
  console.error("Redis error:", err);
});

// Connect on startup
export async function connectRedis() {
  if (!redisClient.isOpen) {
    await redisClient.connect();
    console.log("Redis connected");
  }
}

// Graceful shutdown
export async function disconnectRedis() {
  if (redisClient.isOpen) {
    await redisClient.disconnect();
    console.log("Redis disconnected");
  }
}

// Handle process termination signals
process.on("SIGINT", async () => {
  await disconnectRedis();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await disconnectRedis();
  process.exit(0);
});

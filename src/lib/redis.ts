import { createClient } from "redis";

// Create Redis client
export const redisClient = createClient({
  url: Bun.env.REDIS_URL as string,
});

export const connectRedis = async () => {
  if (redisClient.isOpen) return;

  try {
    redisClient.on("error", (err) => console.error("Redis Client Error:", err));
    redisClient.on("connect", () => console.log("Redis connected"));
    redisClient.on("disconnect", () => console.log("Redis disconnected"));

    await redisClient.connect();
    console.log("Redis client connected successfully");
  } catch (error) {
    console.error("Failed to connect to Redis:", error);
    throw error;
  }
};

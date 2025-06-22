import cors from "@elysiajs/cors";
import swagger from "@elysiajs/swagger";
import { authRoutes } from "./controllers/auth";
import { config } from "./utils/config";
import { baseElysia } from "./base";
import { productRoutes } from "./controllers/products";
import { usersRoutes } from "./controllers/user";
import { tagsRoutes } from "./controllers/tags";
import { categoriesRoutes } from "./controllers/categories";
import { cartRoutes } from "./controllers/cart";
import { messagesRoutes } from "./controllers/messages";
import { wsHandler } from "./ws/handler";
import { vendorRoutes } from "./controllers/vendors";
import { wsRoutes } from "./controllers/ws";
import { searchRoutes } from "./controllers/search";
import { brandRoutes } from "./controllers/brands";
import { addressRoutes } from "./controllers/address";
import { connectRedis } from "./lib/redis"; // Add this import
import { paymentRoutes } from "./controllers/payment";
import { salesRoutes } from "./controllers/sales";
import { purchaseRoutes } from "./controllers/purchase";
import { uploadRoutes } from "./controllers/upload/upload";

const app = baseElysia()
  .use(cors({}))
  .use(
    swagger({
      path: "/api/swagger",
      documentation: {
        info: {
          title: "AFRA B API Documentation",
          version: "1.0.0",
        },
      },
    }),
  )
  .use(wsHandler)
  .group("/api", (app) =>
    app
      .use(authRoutes)
      .use(productRoutes)
      .use(usersRoutes)
      .use(tagsRoutes)
      .use(categoriesRoutes)
      .use(cartRoutes)
      .use(messagesRoutes)
      .use(vendorRoutes)
      .use(addressRoutes)
      .use(brandRoutes)
      .use(wsRoutes)
      .use(searchRoutes)
      .use(paymentRoutes)
      .use(salesRoutes)
      .use(purchaseRoutes)
      .use(uploadRoutes),
  );

// Initialize Redis connection before starting the server
async function startServer() {
  try {
    console.log("🔄 Connecting to Redis...");
    await connectRedis();
    console.log("✅ Redis connected successfully");

    app.listen(config.PORT);
    console.log(
      `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}/api/swagger`,
    );
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
}

// Start the server
startServer();

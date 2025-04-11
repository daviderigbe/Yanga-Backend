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
      .use(vendorRoutes),
  );

app.listen(config.PORT);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}/api/swagger`,
);

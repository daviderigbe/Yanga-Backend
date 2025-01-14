import cors from "@elysiajs/cors";
import swagger from "@elysiajs/swagger";
import { Elysia } from "elysia";
import { authRoutes } from "./controllers/auth";
import { config } from "./utils/config";
import { logger } from "./plugins/logger";

const app = new Elysia()
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
  .use(logger)
  .group("/api", (app) => app.use(authRoutes));

app.listen(config.PORT);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}/api/swagger`,
);

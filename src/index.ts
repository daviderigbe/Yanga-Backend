import cors from "@elysiajs/cors";
import swagger from "@elysiajs/swagger";
import { authRoutes } from "./controllers/auth";
import { config } from "./utils/config";
import { baseElysia } from "./base";

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
  .group("/api", (app) => app.use(authRoutes));

app.listen(config.PORT);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}/api/swagger`,
);

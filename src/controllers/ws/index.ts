import { createBaseElysia } from "../../base";
import { wsToken } from "./get-ws-token";

const appSwagger = {
  detail: {
    tags: ["WebSocket"],
  },
};

export const wsRoutes = createBaseElysia({
  prefix: "/ws-token",
  detail: appSwagger.detail,
}).use(wsToken);

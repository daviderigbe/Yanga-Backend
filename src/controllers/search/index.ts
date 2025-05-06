import { createBaseElysia } from "../../base";
import { searchEndpoint } from "./search";

const appSwagger = {
  detail: {
    tags: ["Search"],
  },
};

export const searchRoutes = createBaseElysia({
  prefix: "/search",
  detail: appSwagger.detail,
}).use(searchEndpoint);

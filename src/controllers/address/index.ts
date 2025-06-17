import { createBaseElysia } from "../../base";
import { addresses } from "./fetch-address";

const appSwagger = {
  detail: {
    tags: ["Address"],
  },
};

export const addressRoutes = createBaseElysia({
  prefix: "/address",
  detail: appSwagger.detail,
}).use(addresses);

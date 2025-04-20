import { createBaseElysia } from "../../base";
import { fetchTopVendors } from "./fetch-top-vendors";
import { fetchVendors } from "./fetch-vendors";

const appSwagger = {
  detail: {
    tags: ["Products"],
  },
};

export const vendorRoutes = createBaseElysia({
  prefix: "/vendors",
  detail: appSwagger.detail,
})
  .use(fetchTopVendors)
  .use(fetchVendors);

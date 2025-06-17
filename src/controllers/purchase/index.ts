import { createBaseElysia } from "../../base";
import { purchaseHistory } from "./fetch-purchases";

const appSwagger = {
  detail: {
    tags: ["Purchases"],
  },
};

export const purchaseRoutes = createBaseElysia({
  prefix: "/purchases",
  detail: appSwagger.detail,
}).use(purchaseHistory);

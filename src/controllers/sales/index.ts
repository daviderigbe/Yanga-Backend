import { createBaseElysia } from "../../base";
import { saleHistory } from "./fetch-sale-history";

const appSwagger = {
  detail: {
    tags: ["Sales"],
  },
};

export const salesRoutes = createBaseElysia({
  prefix: "/sales",
  detail: appSwagger.detail,
}).use(saleHistory);

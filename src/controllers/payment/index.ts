import { createBaseElysia } from "../../base";
import { savedCards } from "./cards";

const appSwagger = {
  detail: {
    tags: ["Payment"],
  },
};

export const paymentRoutes = createBaseElysia({
  prefix: "/payment",
  detail: appSwagger.detail,
}).use(savedCards);

import { createBaseElysia } from "../../base";
import { savedCards } from "./cards";
import { paystackRoutes } from "./paystack";
import { walletRoutes } from "./paystack";

const appSwagger = {
  detail: {
    tags: ["Payment"],
  },
};

export const paymentRoutes = createBaseElysia({
  prefix: "/payment",
  detail: appSwagger.detail,
})
  .use(savedCards)
  .use(paystackRoutes)
  .use(walletRoutes); 

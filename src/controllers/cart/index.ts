import { createBaseElysia } from "../../base";
import { addToCart } from "./add-product-to-cart";

const appSwagger = {
  detail: {
    tags: ["Cart"],
  },
};

export const cartRoutes = createBaseElysia({
  prefix: "/cart",
  detail: appSwagger.detail,
}).use(addToCart);

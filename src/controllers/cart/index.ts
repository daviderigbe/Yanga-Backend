import { createBaseElysia } from "../../base";
import { addToCart } from "./add-product-to-cart";
import { getCart } from "./get-cart";
import { removeCartItem } from "./remove-cart.item";
import { updateCartItem } from "./update-cart-item";

const appSwagger = {
  detail: {
    tags: ["Cart"],
  },
};

export const cartRoutes = createBaseElysia({
  prefix: "/cart",
  detail: appSwagger.detail,
})
  .use(addToCart)
  .use(getCart)
  .use(updateCartItem)
  .use(removeCartItem);

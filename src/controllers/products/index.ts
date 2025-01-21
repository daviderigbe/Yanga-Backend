import { createBaseElysia } from "../../base";
import { createProduct } from "./create-product";
import { fetchProducts } from "./fetch-products";
import { fetchProductById } from "./fetch-products-details";

const appSwagger = {
  detail: {
    tags: ["Products"],
  },
};

export const productRoutes = createBaseElysia({
  prefix: "/products",
  detail: appSwagger.detail,
})
  .use(fetchProducts)
  .use(fetchProductById)
  .use(createProduct);

import { createBaseElysia } from "../../base";
import { fetchProducts } from "./fetch-products";

const appSwagger = {
  detail: {
    tags: ["Products"],
  },
};

export const productRoutes = createBaseElysia({
  prefix: "/products",
  detail: appSwagger.detail,
}).use(fetchProducts);

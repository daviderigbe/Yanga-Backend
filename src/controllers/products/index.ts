import { createBaseElysia } from "../../base";
import { createProduct } from "./create-product";
import { editProductDetails } from "./edit-product-details";
import { fetchProducts } from "./fetch-products";
import { fetchProductsByCategory } from "./fetch-products-by-category";
import { fetchProductsByTag } from "./fetch-products-by-tag";
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
  .use(createProduct)
  .use(fetchProductsByTag)
  .use(fetchProductsByCategory)
  .use(editProductDetails);

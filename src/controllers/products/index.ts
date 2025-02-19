import { createBaseElysia } from "../../base";
import { createProduct } from "./create-product";
import { deleteProduct } from "./delete-product";
import { editProductDetails } from "./edit-product-details";
import { fetchProducts } from "./fetch-products";
import { fetchProductsByCategory } from "./fetch-products-by-category";
import { fetchProductsByTag } from "./fetch-products-by-tag";
import { fetchProductById } from "./fetch-products-details";
import { likeProduct } from "./like-product";
import { unlikeProduct } from "./unlike-product";

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
  .use(editProductDetails)
  .use(deleteProduct)
  .use(likeProduct)
  .use(unlikeProduct);

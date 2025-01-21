import { createBaseElysia } from "../../base";
import { fetchUserById } from "./fetch-user";
import { fetchUserProducts } from "./fetch-user-products";

const appSwagger = {
  detail: {
    tags: ["Users"],
  },
};

export const productRoutes = createBaseElysia({
  prefix: "/users",
  detail: appSwagger.detail,
})
  .use(fetchUserById)
  .use(fetchUserProducts);

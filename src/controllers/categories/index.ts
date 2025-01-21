import { createBaseElysia } from "../../base";
import { fetchCategories } from "./fetch-categories";

const appSwagger = {
  detail: {
    tags: ["Categories"],
  },
};

export const categoriesRoutes = createBaseElysia({
  prefix: "/categories",
  detail: appSwagger.detail,
}).use(fetchCategories);

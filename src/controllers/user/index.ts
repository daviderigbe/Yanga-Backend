import { createBaseElysia } from "../../base";
import { fetchUserById } from "./fetch-user";

const appSwagger = {
  detail: {
    tags: ["Users"],
  },
};

export const productRoutes = createBaseElysia({
  prefix: "/users",
  detail: appSwagger.detail,
}).use(fetchUserById);

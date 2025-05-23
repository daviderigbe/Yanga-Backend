import { createBaseElysia } from "../../base";

const appSwagger = {
  detail: {
    tags: ["Brand"],
  },
};

export const brandRoutes = createBaseElysia({
  prefix: "/brands",
  detail: appSwagger.detail,
});

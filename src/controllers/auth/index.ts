import { signup } from "./signup";
import { signin } from "./signin";
import { createBaseElysia } from "../../base";
import { logout } from "./signout";

const appSwagger = {
  detail: {
    tags: ["Auth"],
  },
};

export const authRoutes = createBaseElysia({
  prefix: "/auth",
  detail: appSwagger.detail,
})
  .use(logout)
  .use(signup)
  .use(signin);

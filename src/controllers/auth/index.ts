import { signup } from "./signup";
import { signin } from "./signin";
import { createBaseElysia } from "../../base";
import { logout } from "./signout";
import { checkAuth } from "./me";
import { forgotPasswordRoutes } from "./forgot-password";
import { refreshWsToken } from "./refresh-ws-token";
import { provider } from "./provider";
import { providerCallback } from "./provider-callback";

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
  .use(signin)
  .use(provider)
  .use(providerCallback)
  .use(checkAuth)
  .use(forgotPasswordRoutes)
  .use(refreshWsToken);

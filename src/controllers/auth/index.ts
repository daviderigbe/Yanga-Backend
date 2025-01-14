import Elysia from "elysia";
import { signup } from "./signup";

const appSwagger = {
  detail: {
    tags: ["Auth"],
  },
};

export const authRoutes = new Elysia({
  prefix: "/auth",
  detail: appSwagger.detail,
}).use(signup);

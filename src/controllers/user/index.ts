import { createBaseElysia } from "../../base";
import { changePassword } from "./change-password";
import { editProfile } from "./edit-profile";
import { fetchUserById } from "./fetch-user";
import { fetchUserLikedProducts } from "./fetch-user-liked-products";
import { fetchUserProducts } from "./fetch-user-products";
import { fetchUserReviews } from "./fetch-user-reviews";

const appSwagger = {
  detail: {
    tags: ["Users"],
  },
};

export const usersRoutes = createBaseElysia({
  prefix: "/users",
  detail: appSwagger.detail,
})
  .use(fetchUserById)
  .use(fetchUserProducts)
  .use(fetchUserLikedProducts)
  .use(fetchUserReviews)
  .use(editProfile)
  .use(changePassword);

import { createBaseElysia } from "../../base";
import { changeBankDetails } from "./change-bank-details";
import { changePassword } from "./change-password";
import { deactivateAccount } from "./deactivate-account";
import { editProfile } from "./edit-profile";
import { fetchBankDetails } from "./fetch-bank-details";
import { fetchUserById } from "./fetch-user";
import { fetchUserLikedProducts } from "./fetch-user-liked-products";
import { fetchUserProducts } from "./fetch-user-products";
import { fetchUserReviews } from "./fetch-user-reviews";
import { fetchUserSoldProducts } from "./fetch-user-sold-products";
import { followUser } from "./follow-user";
import { reactivateAccount } from "./reactivate-account";
import { toggleBundleBuying } from "./toggle-bundle-buying";
import { toggleUnavailability } from "./toggle-unavailability";
import { unfollowUser } from "./unfollow-user";

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
  .use(fetchUserSoldProducts)
  .use(fetchUserReviews)
  .use(editProfile)
  .use(changePassword)
  .use(followUser)
  .use(unfollowUser)
  .use(toggleBundleBuying)
  .use(toggleUnavailability)
  .use(deactivateAccount)
  .use(reactivateAccount)
  .use(fetchBankDetails)
  .use(changeBankDetails);

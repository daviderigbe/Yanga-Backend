import { createBaseElysia } from "../../base";
import { deleteBrand } from "./delete-brand";
import { getBrandById } from "./get-brand-by-id";
import { getUserBrands } from "./get-user-brands";
import { getVerifiedBrands } from "./get-verified-brands";
import { registerBrandDraft } from "./register-brand-draft";
import { submitBrandForVerification } from "./submit-brand-registration";
import { updateBrand } from "./update-brand";

const appSwagger = {
  detail: {
    tags: ["Brand"],
  },
};

export const brandRoutes = createBaseElysia({
  prefix: "/brands",
  detail: appSwagger.detail,
})
  .use(registerBrandDraft)
  .use(submitBrandForVerification)
  .use(updateBrand)
  .use(deleteBrand)
  .use(getUserBrands)
  .use(getVerifiedBrands)
  .use(getBrandById);

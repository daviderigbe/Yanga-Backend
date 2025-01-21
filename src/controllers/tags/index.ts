import { createBaseElysia } from "../../base";
import { fetchTags } from "./fetch-tags";

const appSwagger = {
  detail: {
    tags: ["Tags"],
  },
};

export const tagsRoutes = createBaseElysia({
  prefix: "/tags",
  detail: appSwagger.detail,
}).use(fetchTags);

import { createBaseElysia } from "../../base";
import { getConversations } from "./get-conversations";

const appSwagger = {
  detail: {
    tags: ["Messages"],
  },
};

export const messagesRoutes = createBaseElysia({
  prefix: "",
  detail: appSwagger.detail,
}).use(getConversations);

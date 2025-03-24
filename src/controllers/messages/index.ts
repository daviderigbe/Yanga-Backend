import { createBaseElysia } from "../../base";
import { getConversationMessages } from "./get-conversation-messages";
import { getConversations } from "./get-conversations";
import { getUnreadCount } from "./get-unread-count";
import { markMessagesAsRead } from "./mark-message-read";
import { sendMessage } from "./send-message";

const appSwagger = {
  detail: {
    tags: ["Messages"],
  },
};

export const messagesRoutes = createBaseElysia({
  prefix: "",
  detail: appSwagger.detail,
})
  .use(getConversations)
  .use(getConversationMessages)
  .use(sendMessage)
  .use(markMessagesAsRead)
  .use(getUnreadCount);

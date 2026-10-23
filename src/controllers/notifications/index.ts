import { createBaseElysia } from "../../base";
import { getNotifications } from "./get-notifications";
import { getUnreadNotificationCount } from "./get-unread-count";
import { markAllNotificationsRead } from "./mark-all-notifications-read";
import { markNotificationRead } from "./mark-notification-read";

const appSwagger = {
  detail: {
    tags: ["Notifications"],
  },
};

export const notificationsRoutes = createBaseElysia({
  prefix: "",
  detail: appSwagger.detail,
})
  .use(getNotifications)
  .use(getUnreadNotificationCount)
  .use(markNotificationRead)
  .use(markAllNotificationsRead);

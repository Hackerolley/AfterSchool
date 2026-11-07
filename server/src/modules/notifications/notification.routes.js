import { Router } from "express";
import { authenticate, requireOrganization } from "../../middleware/authenticate.js";
import { asyncHandler } from "../../utils/async-handler.js";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  clearReadNotification,
  clearReadNotifications,
} from "./notification.controller.js";

const router = Router();
router.use(authenticate, requireOrganization);
router.get("/", asyncHandler(listNotifications));
router.patch("/read-all", asyncHandler(markAllNotificationsRead));
router.delete("/read", asyncHandler(clearReadNotifications));
router.patch("/:notificationId/read", asyncHandler(markNotificationRead));
router.delete("/:notificationId", asyncHandler(clearReadNotification));

export default router;

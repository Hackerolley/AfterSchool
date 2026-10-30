import { Router } from "express";
import { authenticate, requireOrganization } from "../../middleware/authenticate.js";
import { asyncHandler } from "../../utils/async-handler.js";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "./notification.controller.js";

const router = Router();
router.use(authenticate, requireOrganization);
router.get("/", asyncHandler(listNotifications));
router.patch("/read-all", asyncHandler(markAllNotificationsRead));
router.patch("/:notificationId/read", asyncHandler(markNotificationRead));

export default router;

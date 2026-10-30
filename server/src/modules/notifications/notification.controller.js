import { Notification } from "./notification.model.js";
import { HttpError } from "../../utils/http-error.js";

export async function listNotifications(req, res) {
  const filter = {
    organization: req.organization._id,
    recipient: req.membership._id,
  };
  const [notifications, unreadCount] = await Promise.all([
    Notification.find(filter)
      .populate("assignment", "title")
      .sort({ createdAt: -1, _id: -1 })
      .limit(30)
      .lean(),
    Notification.countDocuments({ ...filter, readAt: { $exists: false } }),
  ]);
  res.json({ success: true, data: { notifications, unreadCount } });
}

export async function markNotificationRead(req, res) {
  const notification = await Notification.findOneAndUpdate(
    {
      _id: req.params.notificationId,
      organization: req.organization._id,
      recipient: req.membership._id,
      readAt: { $exists: false },
    },
    { $set: { readAt: new Date() } },
    { new: true },
  );
  if (!notification) {
    const exists = await Notification.exists({
      _id: req.params.notificationId,
      organization: req.organization._id,
      recipient: req.membership._id,
    });
    if (!exists) throw new HttpError(404, "Notification not found");
  }
  res.json({ success: true, data: { id: req.params.notificationId, read: true } });
}

export async function markAllNotificationsRead(req, res) {
  await Notification.updateMany(
    {
      organization: req.organization._id,
      recipient: req.membership._id,
      readAt: { $exists: false },
    },
    { $set: { readAt: new Date() } },
  );
  res.json({ success: true, data: { read: true } });
}

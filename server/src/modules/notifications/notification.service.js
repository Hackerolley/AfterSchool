import { Notification } from "./notification.model.js";

export async function notifyMemberships({
  organization,
  recipients,
  type,
  title,
  message,
  schoolClass,
}) {
  const recipientIds = [...new Set(recipients.filter(Boolean).map((recipient) => recipient.toString()))];
  if (!recipientIds.length) return;

  await Notification.insertMany(recipientIds.map((recipient) => ({
    organization,
    recipient,
    type,
    title,
    message,
    ...(schoolClass ? { class: schoolClass._id || schoolClass } : {}),
  })));
}

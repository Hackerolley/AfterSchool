import { useEffect, useState } from "react";
import { Bell, Check, X } from "lucide-react";
import { apiGet, apiPatch } from "./api.js";

export default function NotificationBell({ organizationId, onOpenAssignment }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pendingId, setPendingId] = useState("");

  async function refresh() {
    try {
      const response = await apiGet("/notifications", organizationId);
      setNotifications(response.data.notifications);
      setUnreadCount(response.data.unreadCount);
      setError("");
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => void refresh(), 45_000);
    return () => window.clearInterval(interval);
  }, [organizationId]);

  async function selectNotification(notification) {
    setPendingId(notification._id);
    setError("");
    try {
      if (!notification.readAt) {
        await apiPatch(`/notifications/${notification._id}/read`, {}, organizationId);
        setNotifications((current) => current.map((item) => item._id === notification._id
          ? { ...item, readAt: new Date().toISOString() }
          : item));
        setUnreadCount((count) => Math.max(0, count - 1));
      }
      setOpen(false);
      if (notification.assignment?._id) onOpenAssignment(notification.assignment._id);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setPendingId("");
    }
  }

  async function markAllRead() {
    setError("");
    try {
      await apiPatch("/notifications/read-all", {}, organizationId);
      const readAt = new Date().toISOString();
      setNotifications((current) => current.map((item) => ({ ...item, readAt })));
      setUnreadCount(0);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  return (
    <div className="notification-control">
      <button
        className="icon-button notification-trigger"
        type="button"
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Bell size={18} />
        {unreadCount > 0 && <span className="notification-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>}
      </button>
      {open && (
        <section className="notification-popover" aria-label="Notifications">
          <div className="notification-popover-heading">
            <div><strong>Notifications</strong><small>{unreadCount ? `${unreadCount} unread` : "You’re all caught up"}</small></div>
            <div>
              {unreadCount > 0 && <button className="notification-mark-all" type="button" onClick={markAllRead}><Check size={14} />Mark all read</button>}
              <button className="icon-button" type="button" aria-label="Close notifications" onClick={() => setOpen(false)}><X size={16} /></button>
            </div>
          </div>
          {error && <p className="notification-error" role="alert">{error}</p>}
          {notifications.length === 0 ? <p className="notification-empty">New submissions and assignment reviews will appear here.</p> : (
            <div className="notification-list">
              {notifications.map((notification) => (
                <button
                  className={`notification-item ${notification.readAt ? "" : "notification-unread"}`}
                  type="button"
                  key={notification._id}
                  disabled={pendingId === notification._id}
                  onClick={() => selectNotification(notification)}
                >
                  <span className="notification-item-dot" />
                  <span><strong>{notification.assignment?.title || "Assignment update"}</strong><small>{notification.message}</small><time>{new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(notification.createdAt))}</time></span>
                </button>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

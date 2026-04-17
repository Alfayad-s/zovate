import { apiClient } from "@/lib/api-client";

export type NotificationWorkspace = {
  id: string;
  name: string;
  logoUrl: string | null;
};

export type NotificationActor = {
  id: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
};

export type AppNotification = {
  id: string;
  userId: string;
  workspaceId: string;
  type: string;
  entityType: string;
  entityId: string;
  triggeredById: string | null;
  data: Record<string, unknown> | null;
  isRead: boolean;
  createdAt: string;
  workspace: NotificationWorkspace;
  triggeredBy: NotificationActor | null;
};

/** Lists notifications; use unread-only for the bell menu so seen items stay out of the list. */
export async function fetchUnreadNotifications(): Promise<AppNotification[]> {
  const { data } = await apiClient.get<AppNotification[]>("/notifications", {
    params: { unreadOnly: true },
  });
  return data;
}

/** Marks task alerts and other non-invite notifications seen after the user closes the panel. */
export async function markNotificationsSeenOnPanelOpen(): Promise<void> {
  await apiClient.patch("/notifications/read/open");
}

export async function markNotificationRead(
  notificationId: string,
): Promise<void> {
  await apiClient.patch(`/notifications/${notificationId}/read`);
}

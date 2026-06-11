export type NotificationType = "Event" | "Result" | "Placement";

export type NotificationItem = {
  id: string;
  type: NotificationType;
  message: string;
  timestamp: string;
};

export type NotificationApiResponse = {
  notifications: NotificationItem[];
  error?: string;
};

export async function fetchNotifications(params) {
  const search = new URLSearchParams({
    limit: String(params.limit),
    page: String(params.page)
  });

  if (params.notificationType && params.notificationType !== "All") {
    search.set("notification_type", params.notificationType);
  }

  const response = await fetch(`/api/notifications?${search.toString()}`, {
    cache: "no-store"
  });
  const body = await response.json();

  if (!response.ok) {
    return {
      notifications: [],
      error: body.error || "Unable to fetch notifications"
    };
  }

  return body;
}

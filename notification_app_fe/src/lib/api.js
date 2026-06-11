const MAX_API_LIMIT = 10;

export async function fetchNotifications(params) {
  const limit = Math.min(MAX_API_LIMIT, Number(params.limit || MAX_API_LIMIT));
  const page = Math.max(1, Number(params.page || 1));

  const search = new URLSearchParams({
    limit: String(limit),
    page: String(page)
  });

  if (params.notificationType && params.notificationType !== "All") {
    search.set("notification_type", params.notificationType);
  }

  try {
    const response = await fetch(`/api/notifications?${search.toString()}`, {
      cache: "no-store"
    });
    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        notifications: [],
        error: body.error || body.message || "Unable to fetch notifications"
      };
    }

    return body;
  } catch (error) {
    return {
      notifications: [],
      error: error instanceof Error ? error.message : "Unable to fetch notifications"
    };
  }
}

export async function fetchNotificationsBatch({ notificationType, total = 20 }) {
  const target = Math.max(total, 10);
  const notifications = [];
  let page = 1;

  while (notifications.length < target) {
    const result = await fetchNotifications({ limit: MAX_API_LIMIT, page, notificationType });
    if (result.error) {
      return result;
    }

    notifications.push(...result.notifications);
    if (result.notifications.length < MAX_API_LIMIT) {
      break;
    }
    page += 1;
    if (page > 5) {
      break;
    }
  }

  return { notifications: notifications.slice(0, target) };
}

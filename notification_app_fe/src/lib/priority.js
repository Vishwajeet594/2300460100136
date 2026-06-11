const typeWeight = {
  Placement: 3,
  Result: 2,
  Event: 1
};

export function priorityScore(notification) {
  const timestamp = new Date(notification.timestamp).getTime();
  return typeWeight[notification.type] * 1_000_000_000_000_000 + timestamp;
}

export function getTopPriorityNotifications(notifications, limit) {
  return [...notifications]
    .sort((a, b) => priorityScore(b) - priorityScore(a))
    .slice(0, limit);
}

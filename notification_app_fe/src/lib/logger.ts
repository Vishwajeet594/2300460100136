export async function logEvent(level: "info" | "warn" | "error", message: string, metadata = {}) {
  await fetch("/api/logs", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      stack: "frontend",
      level,
      package: "notification_app_fe",
      message,
      metadata
    })
  }).catch(() => undefined);
}

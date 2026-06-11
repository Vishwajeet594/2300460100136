"use client";

const storageKey = "campus_notification_viewed_ids";

export function readViewedIds() {
  if (typeof window === "undefined") {
    return new Set();
  }
  const raw = window.localStorage.getItem(storageKey);
  if (!raw) {
    return new Set();
  }
  try {
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : []);
  } catch {
    return new Set();
  }
}

export function saveViewedIds(ids) {
  window.localStorage.setItem(storageKey, JSON.stringify([...ids]));
}

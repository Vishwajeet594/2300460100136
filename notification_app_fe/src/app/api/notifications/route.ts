import { mkdir, appendFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import type { NotificationItem, NotificationType } from "@/lib/types";

const API_URL = "http://4.224.186.213/evaluation-service/notifications";
const validTypes = new Set(["Event", "Result", "Placement"]);

async function logServer(level: "info" | "warn" | "error", message: string, metadata = {}) {
  const directory = path.join(process.cwd(), "logs");
  await mkdir(directory, { recursive: true });
  await appendFile(
    path.join(directory, "application.jsonl"),
    `${JSON.stringify({
      timestamp: new Date().toISOString(),
      stack: "backend",
      level,
      package: "notification_app_fe_api",
      message,
      metadata
    })}\n`,
    "utf8"
  );
}

function normalizeTimestamp(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }
  const parsed = new Date(value.includes("T") ? value : value.replace(" ", "T"));
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function normalizeNotification(raw: Record<string, unknown>): NotificationItem | null {
  const type = raw.Type || raw.type;
  const timestamp = normalizeTimestamp(raw.Timestamp || raw.timestamp);
  const id = raw.ID || raw.id;
  const message = raw.Message || raw.message;

  if (typeof id !== "string" || typeof message !== "string" || typeof type !== "string" || !validTypes.has(type) || !timestamp) {
    return null;
  }

  return {
    id,
    type: type as NotificationType,
    message,
    timestamp
  };
}

export async function GET(request: Request) {
  const token = process.env.EVALUATION_API_TOKEN || process.env.AFFORDMED_ACCESS_TOKEN;
  const requestUrl = new URL(request.url);

  if (!token) {
    await logServer("error", "Missing notification API token");
    return NextResponse.json(
      {
        notifications: [],
        error: "Missing EVALUATION_API_TOKEN or AFFORDMED_ACCESS_TOKEN on the server"
      },
      { status: 500 }
    );
  }

  const upstreamUrl = new URL(API_URL);
  upstreamUrl.searchParams.set("limit", requestUrl.searchParams.get("limit") || "20");
  upstreamUrl.searchParams.set("page", requestUrl.searchParams.get("page") || "1");

  const notificationType = requestUrl.searchParams.get("notification_type");
  if (notificationType && validTypes.has(notificationType)) {
    upstreamUrl.searchParams.set("notification_type", notificationType);
  }

  try {
    await logServer("info", "Fetching notifications from upstream API", {
      limit: upstreamUrl.searchParams.get("limit"),
      page: upstreamUrl.searchParams.get("page"),
      notificationType: notificationType || "All"
    });

    const response = await fetch(upstreamUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json"
      },
      cache: "no-store"
    });

    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      await logServer("error", "Upstream notification API failed", {
        status: response.status
      });
      return NextResponse.json(
        {
          notifications: [],
          error: body.message || "Notification service failed"
        },
        { status: response.status }
      );
    }

    const source = Array.isArray(body.notifications) ? body.notifications : [];
    const notifications = source
      .map((item: Record<string, unknown>) => normalizeNotification(item))
      .filter(Boolean) as NotificationItem[];

    return NextResponse.json({ notifications });
  } catch (error) {
    await logServer("error", "Notification fetch crashed", {
      error: error instanceof Error ? error.message : "unknown"
    });
    return NextResponse.json(
      {
        notifications: [],
        error: "Unable to reach notification service"
      },
      { status: 502 }
    );
  }
}

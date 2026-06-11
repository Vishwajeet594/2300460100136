const fs = require("node:fs/promises");
const path = require("node:path");
const { Log } = require("./logging middleware/logger");

const API_URL = "http://4.224.186.213/evaluation-service/notifications";
const TYPE_WEIGHT = {
  Placement: 3,
  Result: 2,
  Event: 1
};

class MinHeap {
  constructor(compare) {
    this.items = [];
    this.compare = compare;
  }

  size() {
    return this.items.length;
  }

  peek() {
    return this.items[0];
  }

  push(item) {
    this.items.push(item);
    this.bubbleUp(this.items.length - 1);
  }

  replaceTop(item) {
    this.items[0] = item;
    this.bubbleDown(0);
  }

  toSortedDesc() {
    return [...this.items].sort((a, b) => this.compare(b, a));
  }

  bubbleUp(index) {
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.compare(this.items[index], this.items[parent]) >= 0) {
        break;
      }
      [this.items[index], this.items[parent]] = [this.items[parent], this.items[index]];
      index = parent;
    }
  }

  bubbleDown(index) {
    while (true) {
      const left = index * 2 + 1;
      const right = left + 1;
      let smallest = index;

      if (left < this.items.length && this.compare(this.items[left], this.items[smallest]) < 0) {
        smallest = left;
      }
      if (right < this.items.length && this.compare(this.items[right], this.items[smallest]) < 0) {
        smallest = right;
      }
      if (smallest === index) {
        break;
      }
      [this.items[index], this.items[smallest]] = [this.items[smallest], this.items[index]];
      index = smallest;
    }
  }
}

function parseTimestamp(value) {
  if (!value || typeof value !== "string") {
    return null;
  }
  const isoLike = value.includes("T") ? value : value.replace(" ", "T");
  const parsed = new Date(isoLike);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeNotification(raw) {
  const timestamp = parseTimestamp(raw.Timestamp || raw.timestamp || raw.createdAt);
  const type = raw.Type || raw.type || raw.notificationType;

  if (!raw.ID && !raw.id) {
    return null;
  }
  if (!TYPE_WEIGHT[type] || !timestamp) {
    return null;
  }

  return {
    id: raw.ID || raw.id,
    type,
    message: raw.Message || raw.message || "",
    timestamp: timestamp.toISOString(),
    timestampMs: timestamp.getTime()
  };
}

function comparePriority(a, b) {
  const weightDiff = TYPE_WEIGHT[a.type] - TYPE_WEIGHT[b.type];
  if (weightDiff !== 0) {
    return weightDiff;
  }
  const timeDiff = a.timestampMs - b.timestampMs;
  if (timeDiff !== 0) {
    return timeDiff;
  }
  return String(a.id).localeCompare(String(b.id));
}

function topPriorityNotifications(notifications, limit = 10) {
  const heap = new MinHeap(comparePriority);

  for (const notification of notifications) {
    if (heap.size() < limit) {
      heap.push(notification);
      continue;
    }
    if (comparePriority(notification, heap.peek()) > 0) {
      heap.replaceTop(notification);
    }
  }

  return heap.toSortedDesc();
}

async function fetchNotifications({ limit = 200, page = 1, notificationType } = {}) {
  const token = process.env.EVALUATION_API_TOKEN || process.env.AFFORDMED_ACCESS_TOKEN;
  if (!token) {
    throw new Error("Missing EVALUATION_API_TOKEN or AFFORDMED_ACCESS_TOKEN");
  }

  const url = new URL(API_URL);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("page", String(page));
  if (notificationType) {
    url.searchParams.set("notification_type", notificationType);
  }

  Log("backend", "info", "priority_notifications", "Fetching notifications", {
    page,
    limit,
    notificationType: notificationType || "all"
  });

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`Notification API returned ${response.status}`);
  }

  const body = await response.json();
  return Array.isArray(body.notifications) ? body.notifications : [];
}

async function writeOutput(topNotifications) {
  const lines = [
    "# Stage 6 Priority Notification Output",
    "",
    "| Rank | Type | Message | Timestamp | ID |",
    "| --- | --- | --- | --- | --- |",
    ...topNotifications.map((notification, index) =>
      `| ${index + 1} | ${notification.type} | ${notification.message} | ${notification.timestamp} | ${notification.id} |`
    ),
    ""
  ];

  await fs.writeFile(path.join(process.cwd(), "stage6_output.md"), lines.join("\n"), "utf8");
  await fs.mkdir(path.join(process.cwd(), "screenshots"), { recursive: true });
  await fs.writeFile(
    path.join(process.cwd(), "screenshots", "stage6-priority-output.html"),
    `<!doctype html><html><head><meta charset="utf-8"><title>Stage 6 Output</title><style>body{font-family:Arial,sans-serif;margin:32px;background:#f6f8fb;color:#172033}table{border-collapse:collapse;width:100%;background:white}th,td{border:1px solid #d8dee9;padding:10px;text-align:left}th{background:#18345f;color:white}.badge{font-weight:700}</style></head><body><h1>Top 10 Priority Notifications</h1><table><thead><tr><th>Rank</th><th>Type</th><th>Message</th><th>Timestamp</th><th>ID</th></tr></thead><tbody>${topNotifications
      .map(
        (notification, index) =>
          `<tr><td>${index + 1}</td><td class="badge">${notification.type}</td><td>${notification.message}</td><td>${notification.timestamp}</td><td>${notification.id}</td></tr>`
      )
      .join("")}</tbody></table></body></html>`,
    "utf8"
  );
}

async function main() {
  try {
    const rawNotifications = await fetchNotifications({ limit: 200, page: 1 });
    const normalized = rawNotifications.map(normalizeNotification).filter(Boolean);
    const topTen = topPriorityNotifications(normalized, 10);

    await writeOutput(topTen);
    Log("backend", "info", "priority_notifications", "Priority notifications generated", {
      fetched: rawNotifications.length,
      valid: normalized.length,
      output: topTen.length
    });
    process.stdout.write(`Generated ${topTen.length} priority notifications in stage6_output.md\n`);
  } catch (error) {
    Log("backend", "error", "priority_notifications", "Failed to generate priority notifications", {
      error: error.message
    });
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  normalizeNotification,
  topPriorityNotifications,
  comparePriority,
  fetchNotifications
};

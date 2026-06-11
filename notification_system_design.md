# Stage 1

## Core notification actions

The campus notification platform should support these core actions:

- Create a notification for one student, a segment, or all students.
- List notifications for a student with pagination, type filters, and read/unread filters.
- Fetch a single notification detail.
- Mark one notification as read.
- Mark all notifications as read for a student.
- Return unread counts by type.
- Stream real-time notifications to connected clients.

All API examples assume the user is already authorised as required by the test. The client still sends a correlation id so requests can be traced through the logging middleware.

## Common headers

```http
Authorization: Bearer <pre_authorised_token>
Content-Type: application/json
Accept: application/json
X-Correlation-ID: 9d02ac28-6903-4601-86c3-1f34b40766c0
```

## REST API contract

### Create notification

`POST /api/v1/notifications`

Request:

```json
{
  "type": "Placement",
  "title": "CSX Corporation hiring",
  "message": "Applications close today at 5 PM.",
  "audience": {
    "mode": "segment",
    "studentIds": [1042, 1201],
    "departments": ["CSE"],
    "graduationYear": 2026
  },
  "channels": ["in_app", "email"],
  "priority": 90,
  "createdBy": "hr-office"
}
```

Response `201 Created`:

```json
{
  "notificationId": "8a7412bd-6065-4009-8501-a37f11cc848b",
  "status": "accepted",
  "recipientCount": 2,
  "createdAt": "2026-06-11T08:45:00Z"
}
```

### List student notifications

`GET /api/v1/students/{studentId}/notifications?limit=20&page=1&type=Placement&read=false`

Response `200 OK`:

```json
{
  "data": [
    {
      "id": "8a7412bd-6065-4009-8501-a37f11cc848b",
      "type": "Placement",
      "title": "CSX Corporation hiring",
      "message": "Applications close today at 5 PM.",
      "isRead": false,
      "createdAt": "2026-06-11T08:45:00Z",
      "readAt": null
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "hasNext": true
  }
}
```

### Get notification detail

`GET /api/v1/students/{studentId}/notifications/{notificationId}`

Response `200 OK`:

```json
{
  "id": "8a7412bd-6065-4009-8501-a37f11cc848b",
  "type": "Placement",
  "title": "CSX Corporation hiring",
  "message": "Applications close today at 5 PM.",
  "metadata": {
    "company": "CSX Corporation",
    "deadline": "2026-06-11T11:30:00Z"
  },
  "isRead": false,
  "createdAt": "2026-06-11T08:45:00Z"
}
```

### Mark notification as read

`PATCH /api/v1/students/{studentId}/notifications/{notificationId}/read`

Request:

```json
{
  "isRead": true
}
```

Response `200 OK`:

```json
{
  "notificationId": "8a7412bd-6065-4009-8501-a37f11cc848b",
  "isRead": true,
  "readAt": "2026-06-11T08:49:00Z"
}
```

### Mark all as read

`PATCH /api/v1/students/{studentId}/notifications/read-all`

Request:

```json
{
  "type": "Placement"
}
```

Response:

```json
{
  "updatedCount": 7,
  "updatedAt": "2026-06-11T08:50:00Z"
}
```

### Unread counts

`GET /api/v1/students/{studentId}/notifications/unread-counts`

Response:

```json
{
  "total": 14,
  "byType": {
    "Placement": 3,
    "Result": 6,
    "Event": 5
  }
}
```

## Real-time notification mechanism

Use WebSockets for authenticated in-app updates:

- Client connects to `wss://api.example.com/ws/v1/notifications?studentId=1042`.
- Server validates the pre-authorised token and subscribes the socket to `student:1042` and relevant segment channels.
- Notification workers publish events to Redis Pub/Sub or Kafka topics.
- WebSocket gateway pushes compact payloads to online users.
- Client acknowledges delivery with `POST /api/v1/notifications/{id}/delivery-ack`.
- Offline users receive notifications on the next REST fetch.

Example WebSocket event:

```json
{
  "event": "notification.created",
  "notification": {
    "id": "8a7412bd-6065-4009-8501-a37f11cc848b",
    "type": "Placement",
    "title": "CSX Corporation hiring",
    "message": "Applications close today at 5 PM.",
    "createdAt": "2026-06-11T08:45:00Z"
  }
}
```

# Stage 2

## Suggested persistent storage

PostgreSQL is the best fit for the first production version because notifications need strong consistency, relational querying by student/type/read status, transactional fan-out records, partial indexes, table partitioning, JSON metadata, and mature operational tooling. Redis should be used as a cache and WebSocket fan-out helper, not as the source of truth.

## Schema

```sql
CREATE TYPE notification_type AS ENUM ('Event', 'Result', 'Placement');
CREATE TYPE notification_channel AS ENUM ('in_app', 'email');
CREATE TYPE delivery_status AS ENUM ('pending', 'sent', 'failed', 'retrying');

CREATE TABLE students (
  id BIGINT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL UNIQUE,
  department VARCHAR(40) NOT NULL,
  graduation_year INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE notifications (
  id UUID PRIMARY KEY,
  notification_type notification_type NOT NULL,
  title VARCHAR(160) NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by VARCHAR(80) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE student_notifications (
  student_id BIGINT NOT NULL REFERENCES students(id),
  notification_id UUID NOT NULL REFERENCES notifications(id),
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (student_id, notification_id)
);

CREATE TABLE notification_deliveries (
  id BIGSERIAL PRIMARY KEY,
  student_id BIGINT NOT NULL,
  notification_id UUID NOT NULL,
  channel notification_channel NOT NULL,
  status delivery_status NOT NULL DEFAULT 'pending',
  attempt_count INT NOT NULL DEFAULT 0,
  last_error TEXT,
  next_retry_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, notification_id, channel)
);

CREATE INDEX idx_student_notifications_unread
  ON student_notifications (student_id, created_at DESC)
  WHERE is_read = false;

CREATE INDEX idx_notifications_type_created
  ON notifications (notification_type, created_at DESC);

CREATE INDEX idx_delivery_retry
  ON notification_deliveries (status, next_retry_at)
  WHERE status IN ('pending', 'retrying');
```

## Queries mapped to the API

Create a base notification:

```sql
INSERT INTO notifications (id, notification_type, title, message, metadata, created_by)
VALUES ($1, $2, $3, $4, $5::jsonb, $6);
```

Fan out to selected students:

```sql
INSERT INTO student_notifications (student_id, notification_id)
SELECT id, $1
FROM students
WHERE department = $2 AND graduation_year = $3;
```

Fetch unread notifications:

```sql
SELECT n.id, n.notification_type, n.title, n.message, sn.is_read, sn.created_at, sn.read_at
FROM student_notifications sn
JOIN notifications n ON n.id = sn.notification_id
WHERE sn.student_id = $1
  AND sn.is_read = false
  AND ($2::notification_type IS NULL OR n.notification_type = $2)
ORDER BY sn.created_at DESC
LIMIT $3 OFFSET (($4 - 1) * $3);
```

Mark one notification read:

```sql
UPDATE student_notifications
SET is_read = true, read_at = now()
WHERE student_id = $1 AND notification_id = $2;
```

Unread counts:

```sql
SELECT n.notification_type, count(*) AS unread_count
FROM student_notifications sn
JOIN notifications n ON n.id = sn.notification_id
WHERE sn.student_id = $1 AND sn.is_read = false
GROUP BY n.notification_type;
```

## Scale concerns and solutions

As data volume grows, the main problems are large fan-out writes, slow unread scans, bloated indexes, expensive offsets, and email retries competing with API traffic. The fixes are composite or partial indexes for the exact read paths, cursor pagination, monthly partitioning on `student_notifications.created_at`, background workers for fan-out, separate delivery queues, Redis unread-count caching, and archiving old read notifications to cold storage.

# Stage 3

The query is directionally accurate only if the table stores one row per student notification and `studentID` really identifies the recipient. In the normalized schema above, unread state belongs in `student_notifications`, not the base `notifications` table, because a notification can be unread for one student and read for another.

The query is slow because it may scan many rows before filtering by `studentID` and `isRead`, then sort the result by `createdAt`. With 5,000,000 notification rows, a missing composite index turns a common API request into an expensive scan plus sort.

I would change the model and index the access path:

```sql
CREATE INDEX idx_student_unread_created_asc
ON student_notifications (student_id, created_at ASC)
WHERE is_read = false;

SELECT n.id, n.notification_type, n.title, n.message, sn.created_at
FROM student_notifications sn
JOIN notifications n ON n.id = sn.notification_id
WHERE sn.student_id = 1042
  AND sn.is_read = false
ORDER BY sn.created_at ASC
LIMIT 50;
```

The likely computation cost becomes approximately `O(log n + k)` for the indexed lookup and ordered read, where `k` is the number of unread notifications returned. Without the index it is closer to `O(n log n)` in the worst case because the database may scan and sort a much larger set.

Adding indexes on every column is not effective. Indexes speed selected read patterns, but they cost disk, memory, and write time. They also do not help much when a query needs a combination of columns but only single-column indexes exist. Indexes should match high-value filters, joins, and ordering patterns.

Query to find all students who got a placement notification in the last 7 days:

```sql
SELECT DISTINCT s.id, s.name, s.email
FROM students s
JOIN student_notifications sn ON sn.student_id = s.id
JOIN notifications n ON n.id = sn.notification_id
WHERE n.notification_type = 'Placement'
  AND sn.created_at >= now() - interval '7 days'
ORDER BY s.id;
```

# Stage 4

Fetching notifications from the database on every page load should be replaced with a cache-first and event-driven approach.

Use Redis for per-student unread counts and recent notification lists. The API can read `student:{id}:notifications:recent` and `student:{id}:unread_count` first, falling back to PostgreSQL on cache miss. This reduces DB reads dramatically, but introduces invalidation complexity when notifications are read or created.

Use WebSockets for new notifications instead of polling on every page load. The initial page can fetch a paginated snapshot, then receive new items in real time. This improves perceived latency, but requires connection management, reconnect handling, and an offline fallback.

Use cursor pagination instead of offset pagination. Cursor pagination keeps large lists fast because the database continues from a known timestamp/id instead of counting skipped rows. The tradeoff is that random page jumps become harder.

Use materialized counters or cached counters for unread totals. This makes badges fast, but every read/write path must update the counter reliably. If Redis is temporarily stale, the next DB-backed reconciliation should correct it.

Use CDN and browser caching only for static app assets, not personalised notification data. Personalised data can use short-lived client cache with `ETag` or `If-None-Match`, but it must respect privacy and read-state changes.

# Stage 5

## Problems in the proposed implementation

The loop is synchronous and slow for 50,000 students. It mixes three responsibilities in one path: email delivery, DB persistence, and real-time push. A failure midway leaves an unknown partial state. There is no retry policy, idempotency key, batching, rate limiting, or dead-letter queue. If `send_email` fails for 200 students, the system must not manually guess who missed the message; it needs durable delivery records that can be retried safely.

Saving to DB and sending email should not happen as one tightly coupled operation. The notification and intended recipients should be saved transactionally first. Email and WebSocket delivery should be asynchronous side effects driven by a queue. This gives users an in-app source of truth quickly while slow or flaky email providers are retried independently.

## Reliable redesign pseudocode

```text
function notify_all(student_ids, message):
  notification_id = uuid()
  begin_transaction()
    insert notification(notification_id, type='Placement', message)
    bulk_insert student_notifications(student_ids, notification_id, is_read=false)
    bulk_insert notification_deliveries(student_ids, notification_id, channel='email', status='pending')
    bulk_insert notification_deliveries(student_ids, notification_id, channel='in_app', status='pending')
  commit_transaction()

  enqueue('notification.email.batch', notification_id)
  enqueue('notification.in_app.batch', notification_id)
  return { notification_id, status: 'accepted' }

worker email_batch_worker(notification_id):
  pending = claim_pending_deliveries(notification_id, 'email', limit=500)
  for delivery in pending:
    try:
      send_email(delivery.student_id, notification_id)
      mark_delivery_sent(delivery.id)
    catch error:
      increment_attempt(delivery.id)
      if attempt_count < max_attempts:
        mark_retrying(delivery.id, next_retry_at=backoff(attempt_count))
      else:
        mark_failed(delivery.id, error)
        publish_dead_letter(delivery.id)

worker in_app_batch_worker(notification_id):
  pending = claim_pending_deliveries(notification_id, 'in_app', limit=1000)
  for delivery in pending:
    publish_websocket_event(delivery.student_id, notification_id)
    mark_delivery_sent(delivery.id)
```

When logs show 200 email failures, retry only the failed `notification_deliveries` rows. Because each delivery has a unique `(student_id, notification_id, channel)` key, retries are idempotent and do not duplicate in-app notifications.

# Stage 6

Priority is calculated from notification type and recency. Placement receives the highest weight, Result is next, and Event is lowest. Within the same type, newer notifications rank higher. The submitted code implements this using a bounded min-heap so a stream of incoming notifications can maintain the top 10 in `O(log 10)` per new item instead of sorting the entire inbox after every update.

Files added for this stage:

- `priority_notifications.js`: fetches from the protected API, validates notifications, logs through the logging middleware, and prints/writes the top 10.
- `stage6_output.md`: generated output file when the script is run with a valid token.
- `screenshots/stage6-priority-output.png`: screenshot evidence after running with a valid token.

Run:

```powershell
$env:EVALUATION_API_TOKEN="<token>"
node priority_notifications.js
```

# Stage 7

The React/Next implementation is in `notification_app_fe` and runs on `http://localhost:3000`.

Implemented pages:

- `/`: all notifications with pagination, type filtering, viewed/new visual state, and resilient API error handling.
- `/priority`: top `n` priority notifications with type filtering.

Frontend choices:

- Next.js App Router with TypeScript.
- Material UI only for styling and UI controls.
- Server-side API proxy routes keep the protected API token out of the browser.
- Viewed notification ids are stored in `localStorage`, which is suitable for this evaluation because authentication is assumed and no backend read endpoint is provided by the external API.
- Logging is routed through local logging helpers and `/api/logs`; no `console.log` is used.

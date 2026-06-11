# Notification design

## API summary

- POST /api/v1/notifications creates a notification
- GET /api/v1/students/{studentId}/notifications lists notifications
- GET /api/v1/students/{studentId}/notifications/{notificationId} gets details
- PATCH /api/v1/students/{studentId}/notifications/{notificationId}/read marks read
- PATCH /api/v1/students/{studentId}/notifications/read-all marks all read
- GET /api/v1/students/{studentId}/notifications/unread-counts returns unread totals

## Data model

- 
otifications: content and metadata
- student_notifications: recipient read state
- 
otification_deliveries: channel delivery tracking


## Realtime updates

- Authenticated WebSockets notify connected users
- Send events only to subscribed student or segment channels



# Screenshot Notes

The React app was verified locally at `http://127.0.0.1:3000` after a successful production build. The visible UI screenshot showed the Priority Inbox mobile layout and the expected missing-token error state.

Real Stage 6 priority-output screenshots and live notification screenshots require the protected API token in one of these environment variables:

```powershell
$env:EVALUATION_API_TOKEN="<token>"
# or
$env:AFFORDMED_ACCESS_TOKEN="<token>"
```

After setting the token, run:

```powershell
node priority_notifications.js
cd notification_app_fe
npm start
```

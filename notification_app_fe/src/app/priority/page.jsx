"use client";

import RefreshIcon from "@mui/icons-material/Refresh";
import { Alert, Box, Button, CircularProgress, FormControl, InputLabel, MenuItem, Select, Stack, Typography } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { NotificationCard } from "@/components/NotificationCard";
import { NotificationFilters } from "@/components/NotificationFilters";
import { readViewedIds, saveViewedIds } from "@/components/ViewedState";
import { fetchNotificationsBatch } from "@/lib/api";
import { logEvent } from "@/lib/logger";
import { getTopPriorityNotifications } from "@/lib/priority";

export default function PriorityPage() {
  const [type, setType] = useState("All");
  const [topN, setTopN] = useState(10);
  const [notifications, setNotifications] = useState([]);
  const [viewedIds, setViewedIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const priorityNotifications = useMemo(
    () => getTopPriorityNotifications(notifications.filter((notification) => !viewedIds.has(notification.id)), topN),
    [notifications, viewedIds, topN]
  );

  async function loadNotifications(nextType = type) {
    setLoading(true);
    setError(null);

    try {
      const fetchTotal = Math.max(20, topN * 2);
      const result = await fetchNotificationsBatch({ total: fetchTotal, notificationType: nextType });
      if (result.error) {
        setError(result.error);
        setNotifications([]);
        await logEvent("error", "Priority notification fetch failed", { error: result.error });
      } else {
        setNotifications(result.notifications);
        await logEvent("info", "Priority notifications loaded", {
          count: result.notifications.length,
          type: nextType
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load priority notifications";
      setError(message);
      setNotifications([]);
      await logEvent("error", "Priority notification fetch crashed", { error: message });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setViewedIds(readViewedIds());
    loadNotifications("All");
  }, []);

  function handleTypeChange(nextType) {
    setType(nextType);
    loadNotifications(nextType);
  }

  function markViewed(id) {
    const updated = new Set(viewedIds);
    updated.add(id);
    setViewedIds(updated);
    saveViewedIds(updated);
    logEvent("info", "Priority notification marked viewed", { id });
  }

  return (
    <AppShell>
      <Stack spacing={3}>
        <Box>
          <Typography variant="h4">Priority Inbox</Typography>
          <Typography color="text.secondary">
            Highest value unread notifications ranked by type and recency
          </Typography>
        </Box>

        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
          <Box sx={{ flexGrow: 1 }}>
            <NotificationFilters type={type} onTypeChange={handleTypeChange} />
          </Box>
          <FormControl size="small" sx={{ minWidth: 160, bgcolor: "background.paper" }}>
            <InputLabel id="top-n-label">Show top</InputLabel>
            <Select labelId="top-n-label" value={topN} label="Show top" onChange={(event) => setTopN(Number(event.target.value))}>
              <MenuItem value={10}>Top 10</MenuItem>
              <MenuItem value={15}>Top 15</MenuItem>
              <MenuItem value={20}>Top 20</MenuItem>
            </Select>
          </FormControl>
        </Stack>

        {error ? (
          <Alert
            severity="error"
            action={
              <Button color="inherit" size="small" startIcon={<RefreshIcon />} onClick={() => loadNotifications()}>
                Retry
              </Button>
            }
          >
            {error}
          </Alert>
        ) : null}

        {loading ? (
          <Stack alignItems="center" sx={{ py: 8 }}>
            <CircularProgress />
          </Stack>
        ) : (
          <Stack spacing={1.5}>
            {priorityNotifications.map((notification, index) => (
              <NotificationCard
                key={notification.id}
                notification={notification}
                viewed={viewedIds.has(notification.id)}
                onMarkViewed={markViewed}
                rank={index + 1}
              />
            ))}
            {!priorityNotifications.length && !error ? (
              <Alert severity="info">No unread notifications match the selected priority filters.</Alert>
            ) : null}
          </Stack>
        )}
      </Stack>
    </AppShell>
  );
}

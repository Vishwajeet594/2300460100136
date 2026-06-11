"use client";

import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import RefreshIcon from "@mui/icons-material/Refresh";
import { Alert, Box, Button, CircularProgress, Stack, Typography } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { NotificationCard } from "@/components/NotificationCard";
import { NotificationFilters } from "@/components/NotificationFilters";
import { readViewedIds, saveViewedIds } from "@/components/ViewedState";
import { fetchNotifications } from "@/lib/api";
import { logEvent } from "@/lib/logger";

const pageSize = 12;

export default function HomePage() {
  const [type, setType] = useState("All");
  const [page, setPage] = useState(1);
  const [notifications, setNotifications] = useState([]);
  const [viewedIds, setViewedIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !viewedIds.has(notification.id)).length,
    [notifications, viewedIds]
  );

  async function loadNotifications(nextPage = page, nextType = type) {
    setLoading(true);
    setError(null);
    const result = await fetchNotifications({ limit: pageSize, page: nextPage, notificationType: nextType });
    if (result.error) {
      setError(result.error);
      setNotifications([]);
      await logEvent("error", "All notification fetch failed", { error: result.error });
    } else {
      setNotifications(result.notifications);
      await logEvent("info", "All notifications loaded", {
        count: result.notifications.length,
        page: nextPage,
        type: nextType
      });
    }
    setLoading(false);
  }

  useEffect(() => {
    setViewedIds(readViewedIds());
    loadNotifications(1, "All");
  }, []);

  function markViewed(id) {
    const updated = new Set(viewedIds);
    updated.add(id);
    setViewedIds(updated);
    saveViewedIds(updated);
    logEvent("info", "Notification marked viewed", { id });
  }

  function handleTypeChange(nextType) {
    setType(nextType);
    setPage(1);
    loadNotifications(1, nextType);
  }

  function handlePageChange(nextPage) {
    if (nextPage < 1) {
      return;
    }
    setPage(nextPage);
    loadNotifications(nextPage, type);
  }

  return (
    <AppShell>
      <Stack spacing={3}>
        <Box>
          <Typography variant="h4">All Notifications</Typography>
          <Typography color="text.secondary">
            {unreadCount} new on this page, {notifications.length} loaded
          </Typography>
        </Box>

        <NotificationFilters type={type} onTypeChange={handleTypeChange} />

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
            {notifications.map((notification) => (
              <NotificationCard
                key={notification.id}
                notification={notification}
                viewed={viewedIds.has(notification.id)}
                onMarkViewed={markViewed}
              />
            ))}
            {!notifications.length && !error ? <Alert severity="info">No notifications found.</Alert> : null}
          </Stack>
        )}

        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Button startIcon={<ChevronLeftIcon />} variant="outlined" disabled={page === 1} onClick={() => handlePageChange(page - 1)}>
            Previous
          </Button>
          <Typography variant="body2" color="text.secondary">
            Page {page}
          </Typography>
          <Button endIcon={<ChevronRightIcon />} variant="outlined" onClick={() => handlePageChange(page + 1)}>
            Next
          </Button>
        </Stack>
      </Stack>
    </AppShell>
  );
}

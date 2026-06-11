"use client";

import BusinessCenterIcon from "@mui/icons-material/BusinessCenter";
import CelebrationIcon from "@mui/icons-material/Celebration";
import SchoolIcon from "@mui/icons-material/School";
import { Box, Button, Chip, Paper, Stack, Tooltip, Typography } from "@mui/material";
import type { NotificationItem } from "@/lib/types";

const iconByType = {
  Placement: <BusinessCenterIcon fontSize="small" />,
  Result: <SchoolIcon fontSize="small" />,
  Event: <CelebrationIcon fontSize="small" />
};

const colorByType = {
  Placement: "primary",
  Result: "secondary",
  Event: "success"
} as const;

export function NotificationCard({
  notification,
  viewed,
  onMarkViewed,
  rank
}: {
  notification: NotificationItem;
  viewed: boolean;
  onMarkViewed: (id: string) => void;
  rank?: number;
}) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        borderRadius: 2,
        borderColor: viewed ? "divider" : "primary.main",
        bgcolor: viewed ? "background.paper" : "#eef8fb"
      }}
    >
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ xs: "stretch", sm: "center" }}>
        {typeof rank === "number" ? (
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              bgcolor: "primary.main",
              color: "primary.contrastText",
              display: "grid",
              placeItems: "center",
              fontWeight: 800,
              flexShrink: 0
            }}
          >
            {rank}
          </Box>
        ) : null}
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Chip
              icon={iconByType[notification.type]}
              label={notification.type}
              color={colorByType[notification.type]}
              size="small"
            />
            <Chip label={viewed ? "Viewed" : "New"} size="small" variant={viewed ? "outlined" : "filled"} />
            <Typography variant="caption" color="text.secondary">
              {new Intl.DateTimeFormat("en-IN", {
                dateStyle: "medium",
                timeStyle: "short"
              }).format(new Date(notification.timestamp))}
            </Typography>
          </Stack>
          <Typography variant="subtitle1" sx={{ mt: 1, fontWeight: 800, overflowWrap: "anywhere" }}>
            {notification.message}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>
            {notification.id}
          </Typography>
        </Box>
        <Tooltip title={viewed ? "Already marked as viewed" : "Mark this notification as viewed"}>
          <span>
            <Button variant="outlined" disabled={viewed} onClick={() => onMarkViewed(notification.id)}>
              Mark viewed
            </Button>
          </span>
        </Tooltip>
      </Stack>
    </Paper>
  );
}

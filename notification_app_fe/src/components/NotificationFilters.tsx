"use client";

import FilterAltIcon from "@mui/icons-material/FilterAlt";
import { FormControl, InputLabel, MenuItem, Paper, Select, Stack, Typography } from "@mui/material";
import type { NotificationType } from "@/lib/types";

export type NotificationFilter = NotificationType | "All";

export function NotificationFilters({
  type,
  onTypeChange
}: {
  type: NotificationFilter;
  onTypeChange: (type: NotificationFilter) => void;
}) {
  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ xs: "stretch", sm: "center" }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ flexGrow: 1 }}>
          <FilterAltIcon color="primary" />
          <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
            Filters
          </Typography>
        </Stack>
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel id="notification-type-label">Type</InputLabel>
          <Select
            labelId="notification-type-label"
            value={type}
            label="Type"
            onChange={(event) => onTypeChange(event.target.value as NotificationFilter)}
          >
            <MenuItem value="All">All</MenuItem>
            <MenuItem value="Placement">Placement</MenuItem>
            <MenuItem value="Result">Result</MenuItem>
            <MenuItem value="Event">Event</MenuItem>
          </Select>
        </FormControl>
      </Stack>
    </Paper>
  );
}

"use client";

import NotificationsIcon from "@mui/icons-material/Notifications";
import PriorityHighIcon from "@mui/icons-material/PriorityHigh";
import { AppBar, Box, Button, Container, Stack, Toolbar, Typography } from "@mui/material";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <AppBar position="sticky" elevation={1} color="inherit">
        <Toolbar sx={{ gap: 2, flexWrap: "wrap", py: { xs: 1, sm: 0 } }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ flexGrow: 1, minWidth: 220 }}>
            <NotificationsIcon color="primary" />
            <Box>
              <Typography variant="h6" sx={{ lineHeight: 1.1, fontWeight: 800 }}>
                Campus Notifications
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Placements, Events, Results
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1}>
            <Button
              LinkComponent={Link}
              href="/"
              variant={pathname === "/" ? "contained" : "outlined"}
              startIcon={<NotificationsIcon />}
            >
              All
            </Button>
            <Button
              LinkComponent={Link}
              href="/priority"
              variant={pathname === "/priority" ? "contained" : "outlined"}
              startIcon={<PriorityHighIcon />}
            >
              Priority
            </Button>
          </Stack>
        </Toolbar>
      </AppBar>
      <Container maxWidth="lg" sx={{ py: { xs: 2, md: 4 } }}>
        {children}
      </Container>
    </Box>
  );
}

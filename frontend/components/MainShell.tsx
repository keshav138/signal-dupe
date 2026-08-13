"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Box, CircularProgress } from "@mui/material";
import ConversationList from "@/components/ConversationList";
import { useStore } from "@/lib/store";
import { ConnectionToast } from "./SettingsPane";

export default function MainShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, initialized, init } = useStore();

  useEffect(() => {
    if (!initialized) init();
  }, [initialized, init]);

  useEffect(() => {
    if (initialized && !user) router.replace("/login");
  }, [initialized, user, router]);

  if (!initialized || !user) {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      <Box
        component="aside"
        sx={{
          width: { xs: "100%", md: 320 },
          flexShrink: 0,
          borderRight: 1,
          borderColor: "divider",
          bgcolor: "background.paper",
        }}
      >
        <ConversationList />
      </Box>
      <Box
        component="main"
        sx={{ flex: 1, minWidth: 0, display: { xs: "none", md: "block" } }}
      >
        {children}
      </Box>
      <ConnectionToast />
    </Box>
  );
}

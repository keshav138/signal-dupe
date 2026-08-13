"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { CircularProgress, Box } from "@mui/material";
import { useStore } from "@/lib/store";

export default function Home() {
  const router = useRouter();
  const { user, initialized, init } = useStore();

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    if (!initialized) return;
    router.replace(user ? "/chats" : "/login");
  }, [initialized, user, router]);

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <CircularProgress />
    </Box>
  );
}

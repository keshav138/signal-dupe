"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
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
    <div className="flex min-h-full items-center justify-center bg-signal-bg text-ink-muted">
      Loading...
    </div>
  );
}

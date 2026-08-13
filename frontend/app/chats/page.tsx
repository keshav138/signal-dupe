"use client";

import { useStore } from "@/lib/store";

export default function ChatsPlaceholder() {
  const user = useStore((s) => s.user);
  return (
    <div className="flex min-h-full flex-1 items-center justify-center bg-signal-bg">
      <div className="text-center">
        <p className="text-lg font-medium text-ink">
          Signed in as {user?.display_name ?? "..."}
        </p>
        <p className="mt-1 text-sm text-ink-muted">
          Chat list coming in the next phase.
        </p>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Box, CircularProgress } from "@mui/material";
import MessageBubble from "./MessageBubble";
import { useStore } from "@/lib/store";
import { api } from "@/lib/api";
import type { Message } from "@/lib/types";

export default function MessageList({ conversationId }: { conversationId: number }) {
  const { messages, user } = useStore();
  const list = messages[conversationId] || [];
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const listLengthRef = useRef(list.length);
  const isInitialScroll = useRef(true);

  // Scroll to bottom when new messages arrive (but not on first mount jump).
  useEffect(() => {
    const prevLength = listLengthRef.current;
    listLengthRef.current = list.length;
    if (isInitialScroll.current && list.length > 0) {
      isInitialScroll.current = false;
      bottomRef.current?.scrollIntoView({ block: "end" });
      return;
    }
    if (list.length > prevLength) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [list.length]);

  const loadOlder = useCallback(async () => {
    if (loadingOlder || !hasMore || list.length === 0) return;
    setLoadingOlder(true);
    try {
      const oldest = list[0];
      const older = await api.get<Message[]>(
        `/conversations/${conversationId}/messages?before_id=${oldest.id}&limit=50`
      );
      if (older.length === 0) {
        setHasMore(false);
        return;
      }
      const { messages: all } = useStore.getState();
      const existing = all[conversationId] || [];
      const merged = [...older.filter((m) => !existing.some((x) => x.id === m.id)), ...existing];
      useStore.setState({ messages: { ...all, [conversationId]: merged } });
      setHasMore(older.length === 50);
    } catch {
      /* network */
    } finally {
      setLoadingOlder(false);
    }
  }, [conversationId, hasMore, loadingOlder, list]);

  // Determine if there are more messages to load (fetch count lazily).
  useEffect(() => {
    if (list.length === 0) return;
    setHasMore(list.length >= 50);
  }, [conversationId, list.length]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollTop < 60) loadOlder();
  };

  const today = new Date();
  let lastDateLabel = "";

  return (
    <Box
      ref={scrollRef}
      onScroll={handleScroll}
      sx={{
        flex: 1,
        overflowY: "auto",
        px: 2,
        py: 2,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {loadingOlder && (
        <Box sx={{ display: "flex", justifyContent: "center", py: 1 }}>
          <CircularProgress size={20} />
        </Box>
      )}

      {list.map((message: Message) => {
        const date = new Date(message.created_at);
        const dateLabel = date.toDateString() === today.toDateString() ? "Today" : date.toLocaleDateString();
        const showDate = dateLabel !== lastDateLabel;
        lastDateLabel = dateLabel;
        return (
          <Box key={message.client_temp_id || message.id}>
            {showDate && (
              <Box sx={{ textAlign: "center", my: 2 }}>
                <Box
                  sx={{
                    display: "inline-block",
                    px: 2,
                    py: 0.5,
                    borderRadius: 999,
                    bgcolor: "rgba(0,0,0,0.06)",
                    fontSize: 12,
                    color: "text.secondary",
                  }}
                >
                  {dateLabel}
                </Box>
              </Box>
            )}
            <MessageBubble message={message} isOwn={message.sender_id === user?.id} />
          </Box>
        );
      })}
      <div ref={bottomRef} />
    </Box>
  );
}

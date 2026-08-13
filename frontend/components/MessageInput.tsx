"use client";

import { useEffect, useRef, useState } from "react";
import { Box, IconButton, Paper, TextField, Typography } from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import CloseIcon from "@mui/icons-material/Close";
import type { Message } from "@/lib/types";
import { useStore } from "@/lib/store";

export default function MessageInput({ conversationId }: { conversationId: number }) {
  const { sendMessage, sendTyping, messages, replyTo, setReplyTo } = useStore();
  const [text, setText] = useState("");
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setReplyTo(null);
    inputRef.current?.focus();
  }, [conversationId, setReplyTo]);

  const handleSend = () => {
    const content = text.trim();
    if (!content) return;
    sendMessage({
      conversation_id: conversationId,
      content,
      reply_to_id: replyTo?.id ?? null,
      client_temp_id: crypto.randomUUID(),
    });
    setText("");
    setReplyTo(null);
    sendTyping(conversationId, false);
  };

  const handleChange = (value: string) => {
    setText(value);
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    sendTyping(conversationId, true);
    typingTimeout.current = setTimeout(() => {
      sendTyping(conversationId, false);
    }, 2000);
  };

  useEffect(() => {
    return () => {
      if (typingTimeout.current) clearTimeout(typingTimeout.current);
    };
  }, []);

  const replySource = replyTo
    ? messages[conversationId]?.find((m) => m.id === replyTo.id) ?? replyTo
    : null;

  return (
    <Box sx={{ p: 2, bgcolor: "background.paper", borderTop: 1, borderColor: "divider" }}>
      {replySource && (
        <Paper
          elevation={0}
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            px: 1.5,
            py: 0.75,
            mb: 1,
            borderRadius: "12px",
            bgcolor: "rgba(58,118,240,0.08)",
            borderLeft: 4,
            borderColor: "primary.main",
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="caption" sx={{ fontWeight: 600, display: "block" }}>
              Replying to {replySource.sender?.display_name || "message"}
            </Typography>
            <Typography variant="caption" noWrap sx={{ display: "block", color: "text.secondary" }}>
              {replySource.content}
            </Typography>
          </Box>
          <IconButton size="small" onClick={() => setReplyTo(null)}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Paper>
      )}

      <Box sx={{ display: "flex", alignItems: "flex-end", gap: 1 }}>
        <TextField
          inputRef={inputRef}
          fullWidth
          multiline
          maxRows={4}
          placeholder="Message"
          value={text}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          size="small"
        />
        <IconButton color="primary" onClick={handleSend} disabled={!text.trim()}>
          <SendIcon />
        </IconButton>
      </Box>
    </Box>
  );
}

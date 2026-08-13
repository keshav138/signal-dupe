"use client";

import { useState } from "react";
import { Box, Chip, Menu, MenuItem, Paper, Typography } from "@mui/material";
import DoneIcon from "@mui/icons-material/Done";
import DoneAllIcon from "@mui/icons-material/DoneAll";
import AddReactionIcon from "@mui/icons-material/AddReaction";
import ReplyIcon from "@mui/icons-material/Reply";
import type { Message } from "@/lib/types";
import { useStore } from "@/lib/store";

const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

function StatusTicks({ status }: { status: Message["status"] }) {
  if (status === "sent") return <DoneIcon sx={{ fontSize: 14, color: "rgba(255,255,255,0.8)" }} />;
  if (status === "delivered")
    return <DoneAllIcon sx={{ fontSize: 14, color: "rgba(255,255,255,0.8)" }} />;
  return <DoneAllIcon sx={{ fontSize: 14, color: "#A8C7FF" }} />;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export default function MessageBubble({
  message,
  isOwn,
}: {
  message: Message;
  isOwn: boolean;
}) {
  const { sendReaction, removeReaction, user, setReplyTo } = useStore();
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);
  const [hovered, setHovered] = useState(false);
  const [contextAnchor, setContextAnchor] = useState<null | { x: number; y: number }>(null);

  const hasReacted = message.reactions.some((r) => r.user_id === user?.id);

  const handleReaction = (emoji: string) => {
    if (hasReacted && message.reactions.some((r) => r.user_id === user?.id && r.emoji === emoji)) {
      removeReaction(message.id);
    } else {
      sendReaction(message.id, emoji);
    }
    setAnchor(null);
    setContextAnchor(null);
  };

  const handleReply = () => {
    setReplyTo(message);
    setAnchor(null);
    setContextAnchor(null);
  };

  const groupedReactions = message.reactions.reduce<Record<string, number>>((acc, r) => {
    acc[r.emoji] = (acc[r.emoji] || 0) + 1;
    return acc;
  }, {});

  return (
    <Box
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onContextMenu={(e) => {
        e.preventDefault();
        setContextAnchor({ x: e.clientX, y: e.clientY });
      }}
      sx={{
        display: "flex",
        justifyContent: isOwn ? "flex-end" : "flex-start",
        mb: 0.5,
        px: 1,
      }}
    >
      <Box sx={{ maxWidth: "70%", display: "flex", flexDirection: "column", alignItems: isOwn ? "flex-end" : "flex-start" }}>
        {/* Reply quote */}
        {message.reply_to && (
          <Paper
            elevation={0}
            sx={{
              px: 1.5,
              py: 0.75,
              mb: 0.5,
              borderRadius: "12px",
              bgcolor: isOwn ? "rgba(58,118,240,0.12)" : "rgba(0,0,0,0.05)",
              borderLeft: 3,
              borderColor: isOwn ? "primary.main" : "rgba(0,0,0,0.2)",
              maxWidth: "100%",
            }}
          >
            <Typography
              variant="caption"
              sx={{ display: "block", fontWeight: 600, color: isOwn ? "primary.main" : "text.secondary" }}
            >
              {message.reply_to.sender?.id === user?.id ? "You" : message.reply_to.sender?.display_name}
            </Typography>
            <Typography
              variant="caption"
              noWrap
              sx={{ display: "block", color: "text.secondary" }}
            >
              {message.reply_to.content}
            </Typography>
          </Paper>
        )}

        {/* Bubble */}
        <Paper
          elevation={0}
          sx={{
            px: 1.75,
            py: 1,
            borderRadius: "18px",
            borderTopRightRadius: isOwn ? "6px" : "18px",
            borderTopLeftRadius: isOwn ? "18px" : "6px",
            bgcolor: isOwn ? "primary.main" : "background.paper",
            color: isOwn ? "white" : "text.primary",
            position: "relative",
            border: isOwn ? undefined : 1,
            borderColor: isOwn ? undefined : "divider",
          }}
        >
          <Typography variant="body1" sx={{ wordBreak: "break-word", whiteSpace: "pre-wrap" }}>
            {message.content}
          </Typography>

          {/* Reactions */}
          {Object.keys(groupedReactions).length > 0 && (
            <Box sx={{ display: "flex", gap: 0.5, mt: 0.5, flexWrap: "wrap" }}>
              {Object.entries(groupedReactions).map(([emoji, count]) => (
                <Chip
                  key={emoji}
                  label={`${emoji} ${count > 1 ? count : ""}`}
                  size="small"
                  sx={{
                    height: 22,
                    fontSize: 12,
                    bgcolor: isOwn ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.06)",
                    "& .MuiChip-label": { px: 1 },
                  }}
                />
              ))}
            </Box>
          )}
        </Paper>

        {/* Timestamp + ticks */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 0.25 }}>
          <Typography variant="caption" sx={{ fontSize: 11 }}>
            {formatTime(message.created_at)}
          </Typography>
          {isOwn && <StatusTicks status={message.status} />}
        </Box>
      </Box>

      {/* Hover actions: Reply + React */}
      {hovered && (
        <Box sx={{ alignSelf: "center", ml: 0.5, display: "flex", gap: 0.25 }}>
          <Box
            onClick={() => {
              setReplyTo(message);
            }}
            sx={{ cursor: "pointer", color: "text.secondary", display: "flex", p: 0.5, "&:hover": { color: "primary.main" } }}
            title="Reply"
          >
            <ReplyIcon fontSize="small" />
          </Box>
          <Box
            onClick={(e) => setAnchor(e.currentTarget)}
            sx={{ cursor: "pointer", color: "text.secondary", display: "flex", p: 0.5, "&:hover": { color: "primary.main" } }}
            title="React"
          >
            <AddReactionIcon fontSize="small" />
          </Box>
        </Box>
      )}

      <Menu
        anchorEl={anchor}
        open={!!anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Box sx={{ display: "flex", px: 1, py: 0.5 }}>
          {REACTION_EMOJIS.map((emoji) => (
            <MenuItem key={emoji} onClick={() => handleReaction(emoji)} sx={{ minWidth: 0, p: 1, fontSize: 18 }}>
              {emoji}
            </MenuItem>
          ))}
        </Box>
      </Menu>

      {/* Right-click context menu: always-available Reply + React */}
      <Menu
        open={!!contextAnchor}
        onClose={() => setContextAnchor(null)}
        anchorReference="anchorPosition"
        anchorPosition={contextAnchor ? { top: contextAnchor.y, left: contextAnchor.x } : undefined}
      >
        <MenuItem onClick={handleReply} sx={{ gap: 1 }}>
          <ReplyIcon fontSize="small" /> Reply
        </MenuItem>
        <Box sx={{ display: "flex", px: 1, py: 0.5 }}>
          {REACTION_EMOJIS.map((emoji) => (
            <MenuItem key={emoji} onClick={() => handleReaction(emoji)} sx={{ minWidth: 0, p: 1, fontSize: 18 }}>
              {emoji}
            </MenuItem>
          ))}
        </Box>
      </Menu>
    </Box>
  );
}

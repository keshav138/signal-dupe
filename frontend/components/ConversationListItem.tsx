"use client";

import { useRouter } from "next/navigation";
import {
  Avatar,
  Badge,
  Box,
  ListItemAvatar,
  ListItemButton,
  ListItemText,
  Typography,
} from "@mui/material";
import type { ConversationListItem as ConversationListItemType } from "@/lib/types";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "?") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase();
}

const AVATAR_COLORS = [
  "#3A76F0", "#7C4DFF", "#00897B", "#F4511E",
  "#8E24AA", "#43A047", "#D81B60", "#039BE5",
];

function avatarColor(name: string): string {
  const hash = [...name].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function UserAvatar({
  name,
  avatarUrl,
  size = 48,
}: {
  name: string;
  avatarUrl?: string | null;
  size?: number;
}) {
  if (avatarUrl) {
    return <Avatar src={avatarUrl} sx={{ width: size, height: size }} />;
  }
  return (
    <Avatar
      sx={{
        width: size,
        height: size,
        bgcolor: avatarColor(name),
        fontSize: size * 0.38,
        fontWeight: 500,
      }}
    >
      {initials(name)}
    </Avatar>
  );
}

interface Props {
  conversation: ConversationListItemType;
  currentUserId: number;
  active: boolean;
}

export default function ConversationListItem({ conversation, currentUserId, active }: Props) {
  const router = useRouter();
  const { type, name, other_user, last_message, unread_count, avatar_url } = conversation;

  const title = type === "group" ? name || "Group" : other_user?.display_name || "Chat";
  const avatarSource = type === "group" ? avatar_url : other_user?.avatar_url ?? null;

  let preview = last_message?.content ?? "No messages yet";
  if (type === "group" && last_message) {
    if (last_message.sender_id === currentUserId) {
      preview = `You: ${preview}`;
    } else if (last_message.sender_name) {
      preview = `${last_message.sender_name.split(" ")[0]}: ${preview}`;
    }
  }

  return (
    <ListItemButton
      selected={active}
      onClick={() => router.push(`/chat/${conversation.id}`)}
      sx={{ px: 2, py: 1.5 }}
    >
      <ListItemAvatar>
        <UserAvatar name={title} avatarUrl={avatarSource} />
      </ListItemAvatar>
      <ListItemText
        primary={
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <Typography variant="subtitle1" noWrap sx={{ fontWeight: 600 }}>
              {title}
            </Typography>
            {last_message && (
              <Typography variant="caption" sx={{ ml: 1, flexShrink: 0 }}>
                {formatTimestamp(last_message.created_at)}
              </Typography>
            )}
          </Box>
        }
        secondary={
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Typography variant="body2" noWrap sx={{ flex: 1, minWidth: 0 }}>
              {preview}
            </Typography>
            {unread_count > 0 && (
              <Badge
                badgeContent={unread_count > 99 ? "99+" : unread_count}
                color="primary"
                sx={{ ml: 1, flexShrink: 0 }}
              />
            )}
          </Box>
        }
      />
    </ListItemButton>
  );
}

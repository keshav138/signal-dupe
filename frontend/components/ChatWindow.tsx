"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import {
  AppBar,
  Box,
  CircularProgress,
  IconButton,
  Menu,
  MenuItem,
  Toolbar,
  Typography,
} from "@mui/material";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import GroupIcon from "@mui/icons-material/Group";
import MessageList from "./MessageList";
import MessageInput from "./MessageInput";
import TypingIndicator from "./TypingIndicator";
import GroupMembersModal from "./GroupMembersModal";
import { UserAvatar } from "./ConversationListItem";
import { useStore } from "@/lib/store";
import { api } from "@/lib/api";
import type { ConversationDetail } from "@/lib/types";

function formatLastSeen(iso: string | null): string {
  if (!iso) return "offline";
  const date = new Date(iso);
  const now = new Date();
  const diffMinutes = Math.floor((now.getTime() - date.getTime()) / 60000);
  if (diffMinutes < 1) return "last seen just now";
  if (diffMinutes < 60) return `last seen ${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `last seen ${diffHours}h ago`;
  return `last seen ${date.toLocaleDateString()}`;
}

export default function ChatWindow() {
  const params = useParams<{ id: string }>();
  const conversationId = Number(params.id);
  const {
    user,
    conversations,
    typing,
    presence,
    openConversation,
    getConversationDetail,
  } = useStore();
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [membersOpen, setMembersOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const loadedRef = useRef<number | null>(null);

  const convo = conversations.find((c) => c.id === conversationId);
  const isGroup = convo?.type === "group";
  const otherUser = convo?.other_user;
  const title = isGroup ? convo?.name || "Group" : otherUser?.display_name || "Chat";
  const typingUsers = (typing[conversationId] || [])
    .filter((uid) => uid !== user?.id)
    .map((uid) => {
      if (isGroup) {
        const p = detail?.participants.find((x) => x.user_id === uid);
        return p?.user.display_name || "Someone";
      }
      return title;
    });

  const otherOnline = otherUser ? presence[otherUser.id] === true : false;

  useEffect(() => {
    if (loadedRef.current === conversationId) return;
    loadedRef.current = conversationId;
    openConversation(conversationId);
    getConversationDetail(conversationId).then(setDetail).catch(() => {});
  }, [conversationId, openConversation, getConversationDetail]);

  if (!convo) {
    return (
      <Box sx={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center" }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", bgcolor: "background.default" }}>
      <AppBar position="static" color="transparent" elevation={0} sx={{ borderBottom: 1, borderColor: "divider", bgcolor: "background.paper" }}>
        <Toolbar sx={{ gap: 1 }}>
          <UserAvatar
            name={title}
            avatarUrl={isGroup ? convo.avatar_url : otherUser?.avatar_url}
            size={40}
          />
          <Box sx={{ flex: 1, minWidth: 0, cursor: isGroup ? "pointer" : "default" }} onClick={() => isGroup && setMembersOpen(true)}>
            <Typography variant="subtitle1" noWrap>
              {title}
            </Typography>
            <Typography variant="caption" noWrap>
              {isGroup
                ? `${detail?.participants.length ?? "..."} members`
                : otherOnline
                  ? "online"
                  : formatLastSeen(otherUser?.last_seen ?? null)}
            </Typography>
          </Box>
          <IconButton onClick={(e) => setMenuAnchor(e.currentTarget)}>
            <MoreVertIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      <MessageList conversationId={conversationId} />

      {typingUsers.length > 0 && <TypingIndicator names={typingUsers} />}

      <MessageInput conversationId={conversationId} />

      <Menu anchorEl={menuAnchor} open={!!menuAnchor} onClose={() => setMenuAnchor(null)}>
        {isGroup && (
          <MenuItem onClick={() => { setMembersOpen(true); setMenuAnchor(null); }}>
            <GroupIcon sx={{ mr: 1 }} fontSize="small" />
            View members
          </MenuItem>
        )}
        <MenuItem disabled>Coming soon: call</MenuItem>
      </Menu>

      {isGroup && detail && (
        <GroupMembersModal
          open={membersOpen}
          onClose={() => setMembersOpen(false)}
          conversationId={conversationId}
          detail={detail}
          onDetailChange={setDetail}
        />
      )}
    </Box>
  );
}

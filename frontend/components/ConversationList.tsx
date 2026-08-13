"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  AppBar,
  Box,
  IconButton,
  InputAdornment,
  List,
  ListItemAvatar,
  ListItemButton,
  ListItemText,
  TextField,
  Toolbar,
  Typography,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import GroupAddIcon from "@mui/icons-material/GroupAdd";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import ConversationListItem, { UserAvatar } from "./ConversationListItem";
import GroupCreateModal from "./GroupCreateModal";
import { useStore } from "@/lib/store";
import type { User } from "@/lib/types";

export default function ConversationList() {
  const {
    conversations,
    contacts,
    user,
    startDirectConversation,
    lookupUserByUsername,
  } = useStore();
  const pathname = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [exactUser, setExactUser] = useState<User | null>(null);
  const [lookupState, setLookupState] = useState<"idle" | "searching" | "notfound">("idle");
  const [submittedQuery, setSubmittedQuery] = useState("");

  const activeConversationId = useMemo(() => {
    const match = pathname.match(/^\/chat\/(\d+)/);
    return match ? Number(match[1]) : null;
  }, [pathname]);

  const filteredConversations = useMemo(() => {
    if (!query.trim()) return conversations;
    const q = query.toLowerCase();
    return conversations.filter((c) => {
      const title = c.type === "group" ? c.name || "" : c.other_user?.display_name || "";
      return (
        title.toLowerCase().includes(q) ||
        c.last_message?.content.toLowerCase().includes(q)
      );
    });
  }, [conversations, query]);

  const matchingContacts = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return contacts.filter((c) => c.contact_user.display_name.toLowerCase().includes(q));
  }, [contacts, query]);

  // Only fire the exact-username lookup when the user presses Enter.
  const handleSearchKeyDown = async (e: React.KeyboardEvent) => {
    if (e.key !== "Enter") return;
    const username = query.trim();
    if (!username) {
      setExactUser(null);
      setLookupState("idle");
      return;
    }
    setLookupState("searching");
    setExactUser(null);
    const found = await lookupUserByUsername(username);
    if (found) {
      setExactUser(found);
      setLookupState("idle");
    } else {
      setLookupState("notfound");
      setSubmittedQuery(username);
    }
  };

  const startChatWith = async (userId: number) => {
    const detail = await startDirectConversation(userId);
    setQuery("");
    setExactUser(null);
    setLookupState("idle");
    router.push(`/chat/${detail.id}`);
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <AppBar position="static" color="transparent" elevation={0} sx={{ borderBottom: 1, borderColor: "divider" }}>
        <Toolbar sx={{ justifyContent: "space-between" }}>
          <Typography variant="h6">Chats</Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <IconButton onClick={() => setGroupModalOpen(true)} aria-label="New group">
              <GroupAddIcon />
            </IconButton>
            <Box onClick={() => router.push("/settings")} sx={{ cursor: "pointer" }}>
              <UserAvatar
                name={user?.display_name ?? "?"}
                avatarUrl={user?.avatar_url}
                size={36}
              />
            </Box>
          </Box>
        </Toolbar>
      </AppBar>

      <Box sx={{ p: 2, pb: 1 }}>
        <TextField
          size="small"
          fullWidth
          placeholder="Search chats and contacts"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            // Typing invalidates any previous Enter-submitted lookup.
            setExactUser(null);
            setLookupState("idle");
          }}
          onKeyDown={handleSearchKeyDown}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
        />
        {query.trim() && (
          <Typography variant="caption" sx={{ display: "block", mt: 0.5, px: 0.5 }}>
            Press Enter to find someone by their full username
          </Typography>
        )}
      </Box>

      <List sx={{ flex: 1, overflowY: "auto", pt: 0 }}>
        {/* Exact username match (Enter-submitted) */}
        {exactUser && (
          <ListItemButton sx={{ px: 2, py: 1.5 }} onClick={() => startChatWith(exactUser.id)}>
            <ListItemAvatar>
              <UserAvatar name={exactUser.display_name} avatarUrl={exactUser.avatar_url} size={40} />
            </ListItemAvatar>
            <ListItemText
              primary={exactUser.display_name}
              secondary={`@${exactUser.username} — press to start chatting`}
            />
            <PersonAddIcon color="primary" fontSize="small" />
          </ListItemButton>
        )}

        {lookupState === "searching" && (
          <Box sx={{ py: 2, textAlign: "center" }}>
            <Typography variant="body2">Looking up @{query.trim()}…</Typography>
          </Box>
        )}

        {lookupState === "notfound" && (
          <Box sx={{ py: 2, textAlign: "center", px: 3 }}>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              No user found with username “{submittedQuery}”
            </Typography>
            <Typography variant="caption">
              Usernames must be typed in full to find someone.
            </Typography>
          </Box>
        )}

        {filteredConversations.length === 0 &&
          matchingContacts.length === 0 &&
          !exactUser &&
          lookupState === "idle" && (
            <Box sx={{ py: 8, textAlign: "center", px: 3 }}>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {query ? "No results found" : "No conversations yet"}
              </Typography>
              {!query && (
                <Typography variant="caption">
                  Start a conversation to see it here.
                </Typography>
              )}
            </Box>
          )}

        {matchingContacts.map((contact) => (
          <ListItemButton
            key={`contact-${contact.id}`}
            sx={{ px: 2, py: 1.5 }}
            onClick={() => startChatWith(contact.contact_user_id)}
          >
            <ListItemAvatar>
              <UserAvatar
                name={contact.contact_user.display_name}
                avatarUrl={contact.contact_user.avatar_url}
                size={40}
              />
            </ListItemAvatar>
            <ListItemText
              primary={contact.contact_user.display_name}
              secondary={`@${contact.contact_user.username}`}
            />
          </ListItemButton>
        ))}

        {filteredConversations.map((conversation) => (
          <ConversationListItem
            key={conversation.id}
            conversation={conversation}
            currentUserId={user?.id ?? 0}
            active={conversation.id === activeConversationId}
          />
        ))}
      </List>

      <GroupCreateModal open={groupModalOpen} onClose={() => setGroupModalOpen(false)} />
    </Box>
  );
}

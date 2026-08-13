"use client";

import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import {
  AppBar,
  Box,
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
import ConversationListItem, { UserAvatar } from "./ConversationListItem";
import { useStore } from "@/lib/store";

export default function ConversationList() {
  const { conversations, contacts, user } = useStore();
  const pathname = usePathname();
  const [query, setQuery] = useState("");

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

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <AppBar position="static" color="transparent" elevation={0} sx={{ borderBottom: 1, borderColor: "divider" }}>
        <Toolbar sx={{ justifyContent: "space-between" }}>
          <Typography variant="h6">Chats</Typography>
          <UserAvatar
            name={user?.display_name ?? "?"}
            avatarUrl={user?.avatar_url}
            size={36}
          />
        </Toolbar>
      </AppBar>

      <Box sx={{ p: 2, pb: 1 }}>
        <TextField
          size="small"
          fullWidth
          placeholder="Search chats and contacts"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
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
      </Box>

      <List sx={{ flex: 1, overflowY: "auto", pt: 0 }}>
        {filteredConversations.length === 0 && matchingContacts.length === 0 && (
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
          <ListItemButton key={`contact-${contact.id}`} sx={{ px: 2, py: 1.5 }}>
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
    </Box>
  );
}

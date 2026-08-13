"use client";

import { useState } from "react";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  TextField,
  Typography,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import { UserAvatar } from "./ConversationListItem";
import { useStore } from "@/lib/store";
import { api } from "@/lib/api";
import type { ConversationDetail } from "@/lib/types";

export default function GroupMembersModal({
  open,
  onClose,
  conversationId,
  detail,
  onDetailChange,
}: {
  open: boolean;
  onClose: () => void;
  conversationId: number;
  detail: ConversationDetail;
  onDetailChange: (d: ConversationDetail) => void;
}) {
  const { user, lookupUserByUsername } = useStore();
  const [busy, setBusy] = useState(false);
  const [username, setUsername] = useState("");
  const [addState, setAddState] = useState<"idle" | "searching" | "notfound" | "added">("idle");
  const isAdmin = detail.participants.some(
    (p) => p.user_id === user?.id && p.role === "admin"
  );

  const removeMember = async (userId: number) => {
    setBusy(true);
    try {
      const updated = await api.delete<ConversationDetail>(
        `/conversations/${conversationId}/members/${userId}`
      );
      onDetailChange(updated);
    } catch {
      /* no-op */
    } finally {
      setBusy(false);
    }
  };

  const addMemberByUsername = async () => {
    const name = username.trim();
    if (!name || busy) return;
    setAddState("searching");
    const found = await lookupUserByUsername(name);
    if (!found) {
      setAddState("notfound");
      return;
    }
    if (detail.participants.some((p) => p.user_id === found.id)) {
      setAddState("added");
      setUsername("");
      return;
    }
    setBusy(true);
    try {
      const updated = await api.post<ConversationDetail>(
        `/conversations/${conversationId}/members`,
        { user_id: found.id }
      );
      onDetailChange(updated);
      setAddState("added");
      setUsername("");
    } catch {
      setAddState("notfound");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        {detail.name || "Group members"}
        <Chip label={`${detail.participants.length} members`} size="small" />
      </DialogTitle>
      <DialogContent>
        {isAdmin && (
          <Box sx={{ mb: 2 }}>
            <TextField
              size="small"
              fullWidth
              placeholder="Add someone by username (press Enter)"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setAddState("idle");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") addMemberByUsername();
              }}
              disabled={busy}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <PersonAddIcon fontSize="small" />
                    </InputAdornment>
                  ),
                },
              }}
            />
            {addState === "searching" && (
              <Typography variant="caption" sx={{ display: "block", mt: 0.5 }}>
                Looking up @{username.trim()}…
              </Typography>
            )}
            {addState === "notfound" && (
              <Typography variant="caption" sx={{ display: "block", mt: 0.5, color: "error.main" }}>
                No user found with that username.
              </Typography>
            )}
            {addState === "added" && (
              <Typography variant="caption" sx={{ display: "block", mt: 0.5, color: "primary.main" }}>
                Member added.
              </Typography>
            )}
          </Box>
        )}
        <List dense>
          {detail.participants.map((p) => (
            <ListItem
              key={p.user_id}
              secondaryAction={
                isAdmin && p.user_id !== user?.id ? (
                  <IconButton
                    edge="end"
                    onClick={() => removeMember(p.user_id)}
                    disabled={busy}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                ) : null
              }
            >
              <ListItemAvatar>
                <UserAvatar name={p.user.display_name} avatarUrl={p.user.avatar_url} size={40} />
              </ListItemAvatar>
              <ListItemText
                primary={
                  <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                    {p.user.display_name}
                    {p.role === "admin" && (
                      <Chip label="admin" size="small" color="primary" variant="outlined" />
                    )}
                  </Box>
                }
                secondary={`@${p.user.username}`}
              />
            </ListItem>
          ))}
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

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
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Typography,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
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
  const { user } = useStore();
  const [busy, setBusy] = useState(false);
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
      /* show nothing; snackbar in later phase */
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

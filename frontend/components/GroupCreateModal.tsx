"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItemButton,
  ListItemAvatar,
  ListItemText,
  TextField,
} from "@mui/material";
import { UserAvatar } from "./ConversationListItem";
import { useStore } from "@/lib/store";

export default function GroupCreateModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const { contacts, createGroup } = useStore();
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<number[]>([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (open) {
      setName("");
      setSelected([]);
    }
  }, [open]);

  const toggle = (id: number) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleCreate = async () => {
    if (!name.trim() || selected.length === 0) return;
    setCreating(true);
    try {
      const detail = await createGroup(name.trim(), selected);
      onClose();
      router.push(`/chat/${detail.id}`);
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>New group</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          label="Group name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          sx={{ mb: 2, mt: 1 }}
        />
        <List dense>
          {contacts.map((contact) => (
            <ListItemButton key={contact.id} onClick={() => toggle(contact.contact_user_id)}>
              <Checkbox
                edge="start"
                checked={selected.includes(contact.contact_user_id)}
                tabIndex={-1}
                disableRipple
              />
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
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleCreate}
          disabled={!name.trim() || selected.length === 0 || creating}
        >
          {creating ? "Creating..." : "Create group"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

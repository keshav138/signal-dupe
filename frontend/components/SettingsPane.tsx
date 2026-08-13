"use client";

import { useRouter } from "next/navigation";
import {
  Box,
  Button,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  Snackbar,
  Alert,
  Typography,
} from "@mui/material";
import PersonIcon from "@mui/icons-material/Person";
import DevicesIcon from "@mui/icons-material/Devices";
import ChatIcon from "@mui/icons-material/Chat";
import NotificationsIcon from "@mui/icons-material/Notifications";
import LockIcon from "@mui/icons-material/Lock";
import PaletteIcon from "@mui/icons-material/Palette";
import LogoutIcon from "@mui/icons-material/Logout";
import { useStore } from "@/lib/store";
import { UserAvatar } from "./ConversationListItem";

const SETTINGS_SECTIONS = [
  { icon: <PersonIcon />, label: "Account" },
  { icon: <DevicesIcon />, label: "Linked devices" },
  { icon: <ChatIcon />, label: "Chats" },
  { icon: <NotificationsIcon />, label: "Notifications" },
  { icon: <LockIcon />, label: "Privacy" },
  { icon: <PaletteIcon />, label: "Appearance" },
];

export default function SettingsPane() {
  const router = useRouter();
  const { user, logout } = useStore();

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  return (
    <Box sx={{ height: "100%", overflowY: "auto", bgcolor: "background.default", p: 3 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>
        Settings
      </Typography>

      <Paper elevation={0} sx={{ p: 2, mb: 2, display: "flex", alignItems: "center", gap: 2 }}>
        <UserAvatar name={user?.display_name ?? "?"} avatarUrl={user?.avatar_url} size={56} />
        <Box>
          <Typography variant="subtitle1">{user?.display_name}</Typography>
          <Typography variant="body2">@{user?.username}</Typography>
          <Typography variant="caption">{user?.phone_number}</Typography>
        </Box>
      </Paper>

      <Paper elevation={0} sx={{ mb: 2 }}>
        <List dense>
          {SETTINGS_SECTIONS.map((section) => (
            <ListItemButton key={section.label}>
              <ListItemIcon sx={{ minWidth: 40 }}>{section.icon}</ListItemIcon>
              <ListItemText primary={section.label} />
              <Typography variant="caption" color="text.secondary">
                Coming Soon
              </Typography>
            </ListItemButton>
          ))}
        </List>
      </Paper>

      <Button
        variant="outlined"
        color="error"
        startIcon={<LogoutIcon />}
        onClick={handleLogout}
        fullWidth
      >
        Log out
      </Button>
    </Box>
  );
}

export function useToast() {
  return { show: (msg: string) => console.log("[toast]", msg) };
}

export function ConnectionToast() {
  const wsConnected = useStore((s) => s.wsConnected);
  return (
    <Snackbar open={!wsConnected} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
      <Alert severity="warning">Connection lost — reconnecting...</Alert>
    </Snackbar>
  );
}

"use client";

import { Box, Typography } from "@mui/material";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutlined";

export default function EmptyChatPane() {
  return (
    <Box
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "background.default",
        px: 4,
        textAlign: "center",
      }}
    >
      <Box
        sx={{
          width: 64,
          height: 64,
          borderRadius: "50%",
          bgcolor: "background.paper",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          mb: 2,
        }}
      >
        <ChatBubbleOutlineIcon sx={{ fontSize: 32, color: "text.secondary" }} />
      </Box>
      <Typography variant="h6">Select a conversation</Typography>
      <Typography variant="body2" sx={{ mt: 0.5, maxWidth: 320 }}>
        Choose a chat from the list to start messaging.
      </Typography>
    </Box>
  );
}

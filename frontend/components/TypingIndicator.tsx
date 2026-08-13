"use client";

import { Box, Typography } from "@mui/material";

export default function TypingIndicator({ names }: { names: string[] }) {
  const label =
    names.length === 1
      ? `${names[0]} is typing`
      : names.length === 2
        ? `${names[0]} and ${names[1]} are typing`
        : `${names.length} people are typing`;

  return (
    <Box sx={{ px: 2, py: 0.5, display: "flex", alignItems: "center", gap: 1 }}>
      <Box sx={{ display: "flex", gap: "3px" }}>
        {[0, 1, 2].map((i) => (
          <Box
            key={i}
            sx={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              bgcolor: "text.secondary",
              animation: "typingBounce 1.2s infinite",
              animationDelay: `${i * 0.2}s`,
              "@keyframes typingBounce": {
                "0%, 60%, 100%": { transform: "translateY(0)", opacity: 0.5 },
                "30%": { transform: "translateY(-4px)", opacity: 1 },
              },
            }}
          />
        ))}
      </Box>
      <Typography variant="caption" sx={{ fontStyle: "italic" }}>
        {label}
      </Typography>
    </Box>
  );
}

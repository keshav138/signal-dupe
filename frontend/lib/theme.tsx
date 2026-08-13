"use client";

import { createTheme, CssBaseline, ThemeProvider } from "@mui/material";

export const signalTheme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#3A76F0", dark: "#2C6BED" },
    background: { default: "#F5F5F5", paper: "#FFFFFF" },
    text: { primary: "#1B1B1D", secondary: "#6B6B6F" },
    divider: "rgba(0,0,0,0.08)",
    error: { main: "#D32F2F" },
  },
  shape: { borderRadius: 18 },
  typography: {
    fontFamily:
      '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    h6: { fontWeight: 600 },
    subtitle1: { fontWeight: 600 },
    body1: { fontSize: "0.95rem" },
    body2: { fontSize: "0.875rem", color: "#6B6B6F" },
    caption: { fontSize: "0.75rem", color: "#9C9CA3" },
  },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          borderRadius: 999,
          textTransform: "none",
          fontWeight: 500,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: "none" },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
      },
    },
  },
});

export default function SignalThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider theme={signalTheme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}

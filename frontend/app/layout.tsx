import type { Metadata } from "next";
import type { ReactNode } from "react";
import SignalThemeProvider from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "Signal Clone",
  description: "A Signal-style messaging app",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <SignalThemeProvider>{children}</SignalThemeProvider>
      </body>
    </html>
  );
}

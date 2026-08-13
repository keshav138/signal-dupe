"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Link,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { api, ApiError } from "@/lib/api";
import { useStore } from "@/lib/store";
import type { User } from "@/lib/types";

interface AuthResponse {
  access_token: string;
  user: User;
}

export default function AuthFlow({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const setAuth = useStore((s) => s.setAuth);
  const [step, setStep] = useState<"phone" | "otp" | "profile">("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const requestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const path =
        mode === "register" ? "/auth/register/request-otp" : "/auth/login/request-otp";
      await api.post<{ message: string }>(path, { phone_number: phone });
      setStep("otp");
    } catch (err) {
      if (err instanceof ApiError && err.status === 400 && mode === "login") {
        setError("This phone number isn't registered. Please register first.");
      } else if (err instanceof ApiError && err.status === 400 && mode === "register") {
        setError("This phone number is already registered. Try logging in instead.");
      } else {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) return;
    setError(null);
    if (mode === "register") {
      setStep("profile");
      return;
    }
    setLoading(true);
    try {
      const res = await api.post<AuthResponse>("/auth/login/verify", {
        phone_number: phone,
        otp,
      });
      setAuth(res.access_token, res.user);
      router.push("/chats");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid code");
    } finally {
      setLoading(false);
    }
  };

  const submitProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !displayName.trim()) {
      setError("Display name and username are required.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await api.post<AuthResponse>("/auth/register/verify", {
        phone_number: phone,
        otp,
        username: username.trim(),
        display_name: displayName.trim(),
      });
      setAuth(res.access_token, res.user);
      router.push("/chats");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not complete profile");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "background.default",
        p: 2,
      }}
    >
      <Container maxWidth="xs">
        <Paper elevation={0} sx={{ p: 4 }}>
          <Stack spacing={1} sx={{ alignItems: "center", mb: 3 }}>
            <Box
              sx={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                bgcolor: "primary.main",
                color: "white",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 24,
                fontWeight: 700,
                mb: 1,
              }}
            >
              S
            </Box>
            <Typography variant="h6">
              {mode === "register" ? "Create your account" : "Welcome back"}
            </Typography>
            <Typography variant="body2" align="center">
              {step === "phone" && "Enter your phone number to get started"}
              {step === "otp" && `Enter the 6-digit code sent to ${phone}`}
              {step === "profile" && "Set up your profile"}
            </Typography>
          </Stack>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {step === "phone" && (
            <Box component="form" onSubmit={requestOtp}>
              <Stack spacing={2}>
                <TextField
                  label="Phone number"
                  placeholder="+15550001111"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  autoFocus
                  fullWidth
                  autoComplete="tel"
                />
                <Button
                  type="submit"
                  variant="contained"
                  size="large"
                  disabled={loading || phone.trim().length < 6}
                >
                  {loading ? "Sending code..." : "Send verification code"}
                </Button>
                <Typography variant="caption" align="center">
                  {mode === "register" ? "Already have an account? " : "New here? "}
                  <Link href={mode === "register" ? "/login" : "/register"}>
                    {mode === "register" ? "Log in" : "Create an account"}
                  </Link>
                </Typography>
              </Stack>
            </Box>
          )}

          {step === "otp" && (
            <Box component="form" onSubmit={verifyOtp}>
              <Stack spacing={2}>
                <TextField
                  label="Verification code"
                  value={otp}
                  onChange={(e) =>
                    setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  slotProps={{
                    htmlInput: { inputMode: "numeric", maxLength: 6 },
                  }}
                  autoFocus
                  fullWidth
                  sx={{ "& input": { letterSpacing: "0.5em", fontSize: "1.25rem" } }}
                />
                <Typography variant="caption" align="center">
                  Demo hint: the code is always <strong>123456</strong>
                </Typography>
                <Button
                  type="submit"
                  variant="contained"
                  size="large"
                  disabled={loading || otp.length !== 6}
                >
                  {loading ? "Verifying..." : "Verify"}
                </Button>
                <Button onClick={() => setStep("phone")} sx={{ alignSelf: "center" }}>
                  Use a different number
                </Button>
              </Stack>
            </Box>
          )}

          {step === "profile" && (
            <Box component="form" onSubmit={submitProfile}>
              <Stack spacing={2}>
                <TextField
                  label="Display name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  autoFocus
                  fullWidth
                />
                <TextField
                  label="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  fullWidth
                />
                <Button
                  type="submit"
                  variant="contained"
                  size="large"
                  disabled={loading}
                >
                  {loading ? "Creating account..." : "Finish setup"}
                </Button>
                <Button onClick={() => setStep("otp")} sx={{ alignSelf: "center" }}>
                  Back
                </Button>
              </Stack>
            </Box>
          )}
          {loading && (
            <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
              <CircularProgress size={24} />
            </Box>
          )}
        </Paper>
      </Container>
    </Box>
  );
}

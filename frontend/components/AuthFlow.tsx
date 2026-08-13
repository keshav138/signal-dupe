"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useStore } from "@/lib/store";
import OtpInput from "@/components/OtpInput";
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

  const submitPhone = async (e: React.FormEvent) => {
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

  const submitOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) return;
    setError(null);
    setLoading(true);
    try {
      if (mode === "register") {
        // Register collects profile info before creating the user.
        setStep("profile");
      } else {
        const res = await api.post<AuthResponse>("/auth/login/verify", {
          phone_number: phone,
          otp,
        });
        setAuth(res.access_token, res.user);
        router.push("/");
      }
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
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not complete profile");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-full flex-1 items-center justify-center bg-signal-bg px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-signal-blue text-2xl font-semibold text-white">
            S
          </div>
          <h1 className="text-xl font-semibold text-ink">
            {mode === "register" ? "Create your account" : "Welcome back"}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {step === "phone" && "Enter your phone number to get started"}
            {step === "otp" && `Enter the 6-digit code sent to ${phone}`}
            {step === "profile" && "Set up your profile"}
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </div>
        )}

        {step === "phone" && (
          <form onSubmit={submitPhone} className="space-y-4">
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+15550001111"
              className="w-full rounded-lg border border-black/15 bg-white px-4 py-3 text-base outline-none transition-colors duration-200 focus:border-signal-blue"
              required
              autoFocus
            />
            <button
              type="submit"
              disabled={loading || phone.trim().length < 6}
              className="w-full rounded-full bg-signal-blue py-3 text-base font-medium text-white transition-colors duration-200 hover:bg-signal-blue-dark disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Sending code..." : "Send verification code"}
            </button>
            <p className="text-center text-xs text-ink-faint">
              {mode === "register" ? "Already have an account? " : "New here? "}
              <a
                href={mode === "register" ? "/login" : "/register"}
                className="font-medium text-signal-blue hover:underline"
              >
                {mode === "register" ? "Log in" : "Create an account"}
              </a>
            </p>
          </form>
        )}

        {step === "otp" && (
          <form onSubmit={submitOtp} className="space-y-4">
            <OtpInput value={otp} onChange={setOtp} disabled={loading} />
            <p className="text-center text-xs text-ink-faint">
              Demo hint: the code is always <span className="font-semibold">123456</span>
            </p>
            <button
              type="submit"
              disabled={loading || otp.length !== 6}
              className="w-full rounded-full bg-signal-blue py-3 text-base font-medium text-white transition-colors duration-200 hover:bg-signal-blue-dark disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Verifying..." : "Verify"}
            </button>
            <button
              type="button"
              onClick={() => setStep("phone")}
              className="w-full text-center text-sm text-signal-blue hover:underline"
            >
              Use a different number
            </button>
          </form>
        )}

        {step === "profile" && (
          <form onSubmit={submitProfile} className="space-y-4">
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Display name"
              className="w-full rounded-lg border border-black/15 bg-white px-4 py-3 text-base outline-none transition-colors duration-200 focus:border-signal-blue"
              autoFocus
            />
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              className="w-full rounded-lg border border-black/15 bg-white px-4 py-3 text-base outline-none transition-colors duration-200 focus:border-signal-blue"
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-signal-blue py-3 text-base font-medium text-white transition-colors duration-200 hover:bg-signal-blue-dark disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Creating account..." : "Finish setup"}
            </button>
            <button
              type="button"
              onClick={() => setStep("otp")}
              className="w-full text-center text-sm text-signal-blue hover:underline"
            >
              Back
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

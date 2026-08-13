"use client";

import { useState } from "react";

interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export default function OtpInput({ value, onChange, disabled }: OtpInputProps) {
  const digits = Array.from({ length: 6 }, (_, i) => value[i] || "");
  const [focused, setFocused] = useState(false);

  return (
    <div>
      <div
        className={`flex justify-center gap-2 ${focused ? "ring-2 ring-signal-blue/40 rounded-xl" : ""}`}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      >
        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={value}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, "").slice(0, 6);
            onChange(v);
          }}
          disabled={disabled}
          className="absolute opacity-0 w-1 h-1"
          autoFocus
          aria-label="Verification code"
        />
        {digits.map((d, i) => (
          <div
            key={i}
            onClick={() => {
              const el = document.querySelector<HTMLInputElement>(
                "input[aria-label='Verification code']"
              );
              el?.focus();
            }}
            className={`flex h-12 w-10 items-center justify-center rounded-lg border text-xl font-medium transition-colors duration-200 cursor-text select-none ${
              d
                ? "border-signal-blue bg-white text-ink"
                : "border-black/15 bg-white text-ink-faint"
            }`}
          >
            {d || "•"}
          </div>
        ))}
      </div>
    </div>
  );
}

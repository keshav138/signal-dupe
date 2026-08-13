# Signal — Design Style & UX Reference

Cross-platform reference (iOS / Android / Desktop) for replicating Signal's visual design and interaction patterns.

---

## 1. Design Philosophy

- **Invisible security**: Encryption is default and silent — no toggles, no "enable privacy" buttons. UX never makes the user manage security manually.
- **Native-first, not branded-first**: Signal borrows the host OS's navigation conventions (iOS: bottom tab bar, swipe-back; Android: Material gestures) instead of imposing a custom cross-platform shell. Desktop mirrors the mobile IA but in a two-pane layout.
- **Content over chrome**: Minimal ornamentation, generous whitespace, no gradients/skeuomorphism. The message itself is the focal point.
- **Restraint over feature-signaling**: Unlike WhatsApp/Telegram, Signal avoids stickers, status rings, and busy iconography. Fewer, calmer visual signals.
- **Trust conveyed through clarity, not badges**: No "verified" checkmarks or lock icons plastered everywhere — trust is built via calm, consistent, uncluttered UI + explicit safety-number verification when the user seeks it.

---

## 2. Visual Style

### Color
- **Primary accent**: Signal Blue `#3A76F0` (also `#2C6BED` in some UI contexts) — used sparingly for CTAs, links, active states, own-message bubbles.
- **Neutral base**: Whites/near-whites in light mode (`#FFFFFF`, `#F5F5F5`), true dark grays/blacks in dark mode (`#1B1B1D`, `#121212`) — never pure black.
- **Message bubbles**: Sent = accent blue with white text; received = light gray (`#E9E9EB`) in light mode, dark gray in dark mode. No skeuomorphic tails/gradients — flat, rounded rectangles.
- **Per-conversation accent colors**: Users can assign a custom color per chat (used for the other person's name, bubble tint) — a personalization layer without breaking overall neutrality.
- **Status colors**: Muted, not alarmist — greens/reds used only for functional states (call, delete, disappearing-message ticker), never decorative.

### Typography
- **System fonts**: SF Pro (iOS), Roboto (Android), Inter/system font stack (Desktop) — no custom branded typeface. Reinforces "native app" feel over "branded app" feel.
- **Hierarchy is size + weight, not color**: Conversation names bold/16-17pt, message text regular/15-16pt, timestamps/metadata small (11-12pt) and low-contrast gray.
- **Left-aligned, high line-height** body text for readability; minimal letter-spacing tricks.

### Iconography & Shape
- Line icons, 1.5-2px stroke, consistent optical size — no filled/duotone mixing.
- Rounded corners throughout (avatars fully circular, bubbles ~18px radius, buttons pill/rounded-rect) — soft geometry signals approachability without being playful.
- Avatars: circular, solid-color initials fallback (no illustrated default figures) — calm, deterministic, non-distracting.

### Motion
- Short, functional transitions only (200-250ms ease): screen slides, bubble fade-in on send, keyboard-follow animations.
- No celebratory/gamified animation (confetti, bouncing icons) — motion never becomes a feature in itself.

---

## 3. UX & Interaction Patterns (primary focus)

### 3.1 Information Architecture
- **Flat, 2-3 level max navigation**: Chat list → Conversation → (rarely) a detail sheet. No deep nested menus.
- **Single primary list (Chats)** with tabs/sections only for Calls and Stories — avoids the tab-bloat seen in competitors.
- **Search is unified**: one search bar surfaces chats, messages, and contacts together rather than separate search modes.

### 3.2 Onboarding & Trust-Building
- Setup is minimized to essentials: phone number verification → optional PIN → profile name/photo. No forced permission-grabbing tour.
- Each irreversible/sensitive action (leaving a group, unlinking a device, resetting a safety number) requires an explicit confirmation dialog with plain-language consequences — never a silent action.
- **Progressive disclosure of privacy features**: disappearing messages, screen-lock, safety-number verification are all opt-in and tucked into settings/conversation menus, not pushed at first launch — reduces cognitive load while keeping power available.

### 3.3 Conversation Screen UX
- **Read receipts / typing indicators are togglable and reciprocal** (if you turn them off, you also stop seeing others') — an explicit fairness/consent pattern worth replicating in any privacy-forward chat UX.
- **Delivery/read states via check-mark iconography** (sent → delivered → read) placed subtly under the last bubble, not per-message clutter.
- **Disappearing messages** shown via a small timer icon in the composer bar + a system-message banner when the timer changes — status is always visible, never hidden.
- **Reactions**: long-press → emoji picker overlay; reactions render small and inline, not oversized/animated — keeps focus on content.
- **Reply/quote**: swipe-to-reply (mobile) shows a compact quoted snippet above the composer — fast, gesture-driven, no modal interruption.
- **Media handling**: photos/videos open full-bleed in an immersive viewer with minimal chrome (X to close, share/save icons only appear on tap) — content-first even in media.

### 3.4 Groups
- Group settings are laid out as a clear vertical list (Members → Permissions → Disappearing messages → Group link) — no buried settings.
- **Explicit permission model surfaced in UI**: "Who can edit group info / send messages" is shown as plain toggle rows, not hidden in an admin-only screen — transparency by default.

### 3.5 Calls
- Full-screen, distraction-free call UI; controls (mute, video, end) are large, bottom-anchored, high-contrast even over video — accessibility-first even in a "beautiful" screen.
- Incoming call banner is minimal (name/photo + accept/decline) — no elaborate ringtone-visualizer or branding moment.

### 3.6 Settings
- Settings organized by **user mental model, not internal architecture**: Account, Linked devices, Chats, Notifications, Privacy, Appearance — privacy gets its own top-level section rather than being buried, signaling it as a first-class concern.
- Every privacy setting includes a one-line plain-language explanation beneath it (not just a toggle label) — reduces "what does this actually do" anxiety.

### 3.7 Empty & Error States
- Empty states are calm and instructional (e.g., empty chat list shows a single centered icon + "Start a conversation" CTA) — not blank, not gamified with illustrations/mascots.
- Errors (failed send, network issue) shown as small inline banners/retry affordances on the specific message — never a blocking modal.

### 3.8 Accessibility & Inclusivity
- High contrast ratios maintained in both light/dark themes (WCAG AA minimum).
- Dynamic type / system font-scaling respected — text reflows rather than truncating.
- All icon-only controls have accessible labels (VoiceOver/TalkBack tested) — consistent with the "no user left confused" ethos.

### 3.9 Desktop-Specific
- Two-pane layout: persistent chat list (left, ~320px) + conversation (right) — no single-pane mobile-mirroring.
- Requires linking to a phone (not fully independent) — UX makes this dependency clear via a persistent "linked device" indicator rather than hiding it.
- Keyboard shortcuts for power users (search, new chat, archive) layered on top of the same visual language — desktop gains efficiency without gaining visual complexity.

---

## 4. Core UX Principles to Replicate (summary)

1. **Default-secure, opt-in-visible**: security always on; controls for it are discoverable but never intrusive.
2. **Confirm irreversible actions in plain language**, every time.
3. **Reciprocity in social signals** (read receipts, typing indicators) — mutual opt-in/out.
4. **Flat IA, unified search** — never more than 2-3 taps to any core action.
5. **Content-first visual design** — chrome, color, and motion all recede so messages/media stay the focus.
6. **Explain settings, don't just label them** — every privacy control gets a one-line rationale.
7. **Native platform conventions over custom cross-platform chrome.**
8. **Calm empty/error states** — informative, never decorative or alarming.

---

## 5. Quick Reference Tokens

| Token | Value |
|---|---|
| Primary accent | `#3A76F0` |
| Sent bubble | Accent blue, white text |
| Received bubble (light) | `#E9E9EB` |
| Background (light) | `#FFFFFF` / `#F5F5F5` |
| Background (dark) | `#1B1B1D` / `#121212` |
| Bubble radius | ~18px |
| Avatar shape | Circle |
| Font (iOS/Android/Desktop) | SF Pro / Roboto / Inter (system stacks) |
| Transition duration | 200-250ms ease |

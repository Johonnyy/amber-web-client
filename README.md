# Amber web client

A hands-free, always-listening voice interface for the [Amber](../amber-v2)
backend. The screen is a futuristic ambient display — a large clock — that wakes
when you say **"Amber"**, records your command, sends it to Amber, and speaks the
reply back. There are no buttons to hold; the whole loop is voice-driven.

It is a **thin client**: it records mic audio, plays Amber's streamed audio
reply, and renders a little metadata. All intelligence lives in the backend.

## How it works

```
wake word ("amber") ──► record command ──► (auto end-of-speech)
   ──► send audio over WebSocket ──► Amber transcribes + thinks
   ──► streamed sentence audio plays back ──► back to listening
```

- **Wake word** — local, on-device, via the browser's Web Speech API. It listens
  continuously and, while idle, watches for any configured wake phrase
  (`amber`, `hey amber`, …). Detection lights up the orb.
- **End-of-speech** — once woken, the orb pulses and the mic records. A short
  silence (default 1.3 s) after you stop talking ends the turn automatically.
- **The reply** — Amber streams its answer one sentence at a time; each is played
  in order so it sounds continuous.

The voice-loop state is a single `Phase`: `idle → listening → thinking →
speaking → idle`, which drives the orb's animation.

## Requirements

- A **Chromium browser** (Chrome / Edge) — the wake word needs the Web Speech API.
- **Mic access**, served over **https or localhost** (browsers block the mic
  otherwise). The first tap ("Tap to wake Amber") grants mic + audio permission.

## Running

```bash
npm install
npm run dev          # http://localhost:3000
npm run build        # production build
npm start            # serve the production build
```

Configure it in **Settings** (press <kbd>Esc</kbd>):

- **Appearance** — pick a **theme** (see below), place the **clock** anywhere on a
  3×3 grid, choose the **date format**, 24-hour clock, and seconds.
- **Connection** — **Amber host** (WebSocket URL, default `ws://localhost:8000/ws`),
  **auth token** (sent as `?token=`), **update token** (voice self-update), and
  auto-connect on wake.
- **Voice** — **wake words** (comma-separated) and end-of-speech / max-utterance
  timing.

Settings persist to `localStorage`, so they survive reloads and self-updates
(they live in the browser, untouched by a server redeploy).

## Themes

Each theme is a whole-app skin — background, colours, typography, the status orb,
and the talking-to-Amber view all change together:

- **Aurora** — amber light drifting on charcoal (the default)
- **Daylight** — clean, bright, minimal
- **Midnight** — plain deep black
- **Synthwave** — neon perspective grid + CRT scanlines
- **Deep Space** — parallax starfield + nebula
- **Terminal** — green phosphor CRT with a blinking caret
- **Sunset** — warm, calm shifting gradient

Themes are defined in CSS keyed off `data-theme="<id>"` ([app/globals.css](app/globals.css))
and catalogued in [lib/themes.ts](lib/themes.ts); the shared effect markup is
[app/components/Background.tsx](app/components/Background.tsx). Adding one is a new
entry in `THEMES` plus a `[data-theme="…"]` block.

## Self-update from GitHub (by voice)

Say **"Amber, update yourself"** and the client updates itself: Amber calls the
client's `update` tool → the browser POSTs `/api/update` → the host pulls the
latest code, rebuilds, and restarts → the page reloads onto the new version.
("Amber, what version are you on?" reports the current git commit.)

This is the [client-declared-tools](../amber-v2/app/client_tools.py) half of the
protocol: the client advertises `update`/`version` tools on connect; Amber's
model decides when to call them. The server side (`app/api/update`,
`scripts/self-update.sh`) and production wiring are documented in
[deploy/README.md](deploy/README.md); configure it via [.env](.env.example).

## Stack

Next.js 16 (App Router) + React 19 + Tailwind v4. The client logic is plain
TypeScript modules under `lib/`; the UI is a handful of client components under
`app/`. See [CLAUDE.md](CLAUDE.md) for the file-by-file map and the protocol
contract.

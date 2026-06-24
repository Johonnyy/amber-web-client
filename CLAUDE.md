@AGENTS.md

# CLAUDE.md — Amber web client

The **hands-free** web client for the Amber voice backend (the FastAPI/WebSocket
server in `../amber-v2`). A thin client: it records mic audio, plays Amber's
streamed audio reply, and renders a little metadata. No intelligence of its own.

The sibling `../amber-web-dev-client` is the vanilla-JS **dev/debug** client
(push-to-talk, verbose panels). This one is the polished, always-listening
end-user surface: a futuristic clock that wakes on the word "Amber".

## Stack

Next.js 16 (App Router, Turbopack) + React 19 + Tailwind v4. Browser-only logic
lives in `'use client'` components. **This Next.js has breaking changes from
older versions — read `node_modules/next/dist/docs/` before writing framework
code.** The React-compiler-aware lint (`react-hooks/*`) is strict: don't mutate
refs during render, don't call `setState` synchronously in an effect.

## The voice loop

A single state machine, `Phase` in `lib/types.ts`, drives everything:

```
idle ──(wake word)──► listening ──(VAD silence)──► thinking ──► speaking ──► idle
```

- **idle** — connected, listening for the wake word.
- **listening** — wake word heard; recording the command, VAD running.
- **thinking** — utterance sent; Amber is transcribing / generating.
- **speaking** — playing Amber's streamed reply, sentence by sentence.

## Files

- `app/AmberClient.tsx` — the orchestrator. Owns the `Phase` machine and wires the
  imperative engines together (they live in refs; React state is their
  projection). Wake detection, VAD timing, connection frames, and activation all
  funnel through here.
- `app/components/Clock.tsx` — the live clock centerpiece (idle home screen).
- `app/components/Orb.tsx` — the reactive status orb on the idle home screen; its
  animation is pure CSS keyed by `data-phase` (see `app/globals.css`).
- `app/components/Conversation.tsx` — the **full-screen fluid conversation**. Always
  mounted (so it fades both in and out); takes over the whole screen while
  `phase !== "idle"`. The home (clock + orb) recedes behind it. Drifting liquid
  blobs + large text: your words appear *live* as you speak (interim Web Speech
  transcript), then Amber's reply streams in sentence by sentence, each blurring
  softly into place.
- `app/components/Background.tsx` — the shared **themed background**: renders every
  effect layer (aurora blobs, synthwave grid, starfield, scanlines, gradient
  wash); CSS picks which show per theme. Used on the home screen and again inside
  the conversation with `intense`.
- `app/components/SettingsPanel.tsx` — the Escape-key settings overlay (Appearance
  / Connection / Voice sections, theme picker, 3×3 clock-position grid).

## Themes & layout

Themes are whole-app skins keyed off `data-theme="<id>"` on the stage. `lib/themes.ts`
is the catalog (`THEMES`, `CLOCK_POSITIONS`, `DATE_FORMATS` + `dateOptions`); all the
actual styling is `[data-theme="…"]` blocks in `app/globals.css`. A theme overrides
CSS variables — `--bg`/`--bg-2`, the generic accent `--amber*` (the orb and
conversation colours key off it), `--glow`, `--scrim`, `--font-app`/`--font-clock` —
and toggles which `.fx-*` background layers display. So restyling "literally
everything including the conversation" mostly falls out of variable overrides plus
a couple of per-theme touches (retro glow, terminal caret). The clock is absolutely
positioned by `.clock-anchor[data-pos="…"]`; the orb stays centred. To add a theme:
append to `THEMES` and add a `[data-theme="<id>"]` block (variables + which `.fx-*`
layers to show).
- `app/globals.css` — the whole bespoke theme (amber-on-near-black) and the orb /
  ambient animations.
- `lib/connection.ts` — `AmberConnection`: the WebSocket + `MSG` protocol
  constants; pairs each `audio_chunk` metadata frame with the binary frame that
  follows it; replays `session_id` on reconnect.
- `lib/audioQueue.ts` — `AudioQueue`: plays per-sentence mp3 frames strictly in
  order; `stop()` for interrupt/barge-in.
- `lib/recorder.ts` — `MicRecorder`: one persistent getUserMedia stream; each
  start/stop yields one webm/opus blob (what Whisper expects).
- `lib/speech.ts` — `SpeechEngine`: thin wrapper over the Web Speech API for
  wake-word + voice-activity timing. Produces **no** audio; auto-restarts.
- `lib/settings.ts` — `Settings` type, defaults, `localStorage` load/save, wake
  matching.
- `lib/clientTools.ts` — the **client-declared tools** Amber can call by voice:
  `update` (self-update from GitHub), `version`, and `set_screen` (turn the kiosk
  display on/off). `triggerSelfUpdate` POSTs `/api/update`, then watches the update
  to a terminal state: it reloads when `/api/version` reports the rebuilt server is
  live, but settles via `hooks.onSettled` if `/api/update/status` reports `failed`
  or the deadline passes — so the update overlay never hangs forever. `setScreen`
  POSTs `/api/screen`.
- `lib/types.ts` — `Phase`, `ConnState`.
- `app/api/version/route.ts` — GET: current git commit/branch/subject of the host.
- `app/api/update/route.ts` — POST: seeds `.self-update.status` to `building`, then
  spawns the updater detached; optional `AMBER_UPDATE_TOKEN` gate. See
  `scripts/self-update.sh` and `deploy/README.md`.
- `app/api/update/status/route.ts` — GET: the updater's progress
  (`building`/`done`/`failed`/`idle`) + a log tail, for the client's update watcher.
- `app/api/screen/route.ts` — POST `{state}`: runs the configured `xset` command
  (`AMBER_SCREEN_OFF_CMD`/`AMBER_SCREEN_ON_CMD`) on the host; reuses the
  `AMBER_UPDATE_TOKEN` gate. Needs X-display access — see `deploy/README.md`.

## Self-update (the client tool half of the protocol)

The client advertises tools to Amber via `register_tools` on every `ready`; Amber
calls one with `tool_call`; the client runs it and answers with `tool_result`
(see `AmberClient.dispatchTool` + `lib/connection.ts`). Tool names are declared
bare (`update`) and arrive `client_`-prefixed (`client_update`). The `update`
tool rebuilds + restarts the host and reloads the page — so "Amber, update
yourself" ships a new version hands-free. Server-side config is all env
(`AMBER_UPDATE_TOKEN`, `AMBER_UPDATE_CMD`, …); see `.env.example`.

`scripts/self-update.sh` writes a one-word progress marker to `.self-update.status`
(`building` → `done`/`failed`, the latter via an `ERR` trap) that the client polls
through `/api/update/status`, so a failed or no-op ("already latest") update clears
the overlay with a reason instead of spinning. It deploys **this clone's current
branch by default** (`AMBER_UPDATE_BRANCH` overrides) — don't reintroduce a
hardcoded `main`, which fails on this `master` repo and leaves the update half-done.

## The protocol is the contract

This client speaks Amber's wire protocol (`../amber-v2/app/protocol.py`), mirrored
in the `MSG` constants in `lib/connection.ts`. Treat the message shapes as a
stable public API. Key invariants:

- Binary frame **in** = one full recorded utterance; binary frame **out** = one
  synthesized sentence, always preceded by its `audio_chunk` JSON metadata.
- Audio plays sentence by sentence, in order — never reorder the queue.
- Auth (when enabled) is a `?token=` query param; reconnect adds `?session_id=`.
- `memory` and other additive server frames are advisory — safe to ignore.

If the backend protocol changes, update `MSG` and the `onJson`/`onAudio` handlers
in `AmberClient.tsx` together.

## Gotchas

- **Wake word needs the Web Speech API** (Chromium). On other browsers the client
  surfaces a notice; there is no wake word there yet.
- **Mic + audio playback need a user gesture** — hence the "Tap to wake Amber"
  activation. Don't try to start the mic or autoplay before it.
- Recording starts *at* wake detection, so the orb lighting up is the cue to
  speak your command (the wake word itself isn't part of the sent audio).

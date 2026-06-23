/** User-configurable settings, persisted to localStorage.
 *
 * Reached via the Escape key (settings panel). Everything the client needs to
 * find and authenticate to an Amber backend lives here, plus the knobs that
 * tune the hands-free voice loop (wake words, end-of-speech timing).
 */
import type { ClockPosition, DateFormat, ThemeId } from "@/lib/themes";

export type Settings = {
  /** Amber WebSocket endpoint, e.g. ws://localhost:8000/ws */
  host: string;
  /** Shared-secret auth token, sent as ?token= on the WS URL. Blank = none. */
  token: string;
  /** Comma-separated wake phrases. A heard phrase that contains any of these
   *  (case-insensitive) starts a turn. */
  wakeWords: string;
  /** Silence (ms) after speech before we consider the user finished talking. */
  silenceMs: number;
  /** Hard cap (ms) on a single recorded utterance, in case VAD never fires. */
  maxUtteranceMs: number;
  /** Whole-app skin (background effect, colors, typography, conversation look). */
  theme: ThemeId;
  /** Where the clock sits on screen (3×3 grid + centre). */
  clockPosition: ClockPosition;
  /** How the date reads under the time (or hidden). */
  dateFormat: DateFormat;
  /** Show the clock in 24-hour format. */
  clock24h: boolean;
  /** Include seconds in the time. */
  showSeconds: boolean;
  /** Activate the mic + connect automatically once the screen is woken. */
  autoConnect: boolean;
  /** Secret sent to this client's own /api/update endpoint to authorize a
   *  self-update (must match the host's AMBER_UPDATE_TOKEN). Blank = none. */
  updateToken: string;
};

const KEY = "amber.client.settings";

export const DEFAULTS: Settings = {
  host: "ws://localhost:8000/ws",
  token: "",
  wakeWords: "amber, hey amber, ok amber",
  silenceMs: 1300,
  maxUtteranceMs: 15000,
  theme: "aurora",
  clockPosition: "center",
  dateFormat: "full",
  clock24h: false,
  showSeconds: false,
  autoConnect: true,
  updateToken: "",
};

export function loadSettings(): Settings {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return DEFAULTS;
  }
}

export function saveSettings(s: Settings): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable — settings just won't persist */
  }
}

/** Split the wake-words string into normalized, non-empty phrases. */
export function wakePhrases(s: Settings): string[] {
  return s.wakeWords
    .split(",")
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean);
}

/** True if `heard` (any transcript) contains one of the configured wake phrases. */
export function matchesWake(heard: string, s: Settings): boolean {
  const t = heard.toLowerCase();
  const phrases = wakePhrases(s);
  if (phrases.length === 0) return false;
  return phrases.some((p) => t.includes(p));
}

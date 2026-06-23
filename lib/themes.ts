/** Theme + layout model.
 *
 * A theme is a whole-app skin: background (plain or animated effect), colors,
 * typography, the status orb, and the talking-to-Amber conversation all change
 * with it. The actual styling lives in `app/globals.css` keyed off
 * `data-theme="<id>"` on the stage; this file is just the catalog + the layout
 * options (where the clock sits and how the time/date read).
 */

export type ThemeId =
  | "aurora"
  | "light"
  | "dark"
  | "retro"
  | "space"
  | "terminal"
  | "sunset";

export const THEMES: { id: ThemeId; label: string; blurb: string }[] = [
  { id: "aurora", label: "Aurora", blurb: "Amber light drifting on charcoal" },
  { id: "light", label: "Daylight", blurb: "Clean, bright, minimal" },
  { id: "dark", label: "Midnight", blurb: "Plain deep black" },
  { id: "retro", label: "Synthwave", blurb: "Neon grid & scanlines" },
  { id: "space", label: "Deep Space", blurb: "Drifting starfield & nebula" },
  { id: "terminal", label: "Terminal", blurb: "Green phosphor CRT" },
  { id: "sunset", label: "Sunset", blurb: "Warm, calm gradient" },
];

const THEME_IDS = new Set(THEMES.map((t) => t.id));
export function isThemeId(v: string): v is ThemeId {
  return THEME_IDS.has(v as ThemeId);
}

/** Nine anchor points for the clock — a 3×3 grid plus the centre. */
export type ClockPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "mid-left"
  | "center"
  | "mid-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

/** Row-major order — matches the 3×3 picker in the settings panel. */
export const CLOCK_POSITIONS: ClockPosition[] = [
  "top-left",
  "top-center",
  "top-right",
  "mid-left",
  "center",
  "mid-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
];

export type DateFormat = "full" | "long" | "short" | "numeric" | "weekday" | "none";

export const DATE_FORMATS: { id: DateFormat; label: string }[] = [
  { id: "full", label: "Monday, June 22" },
  { id: "long", label: "June 22, 2026" },
  { id: "short", label: "Mon, Jun 22" },
  { id: "numeric", label: "06/22/2026" },
  { id: "weekday", label: "Monday" },
  { id: "none", label: "Hidden" },
];

/** Intl options for a given date format (null = don't render the date). */
export function dateOptions(fmt: DateFormat): Intl.DateTimeFormatOptions | null {
  switch (fmt) {
    case "full":
      return { weekday: "long", month: "long", day: "numeric" };
    case "long":
      return { month: "long", day: "numeric", year: "numeric" };
    case "short":
      return { weekday: "short", month: "short", day: "numeric" };
    case "numeric":
      return { year: "numeric", month: "2-digit", day: "2-digit" };
    case "weekday":
      return { weekday: "long" };
    case "none":
      return null;
  }
}

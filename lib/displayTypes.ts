/** Shared types for the rich-display widgets Amber renders on the client.
 *
 * One source of truth imported by both the tool layer (`lib/displayTools.ts`,
 * which declares the schemas Amber calls) and the renderers
 * (`app/components/display/*`). A `DisplayBlock` is one rendered widget; the
 * conversation surface shows a stack of them in order.
 */

/** One rendered widget: which display tool produced it + its raw payload. */
export type DisplayBlock = {
  id: number;
  tool: string;
  payload: Record<string, unknown>;
};

export type Tone = "neutral" | "positive" | "warning" | "danger" | "accent";

export type Badge = { text: string; tone?: Tone };
export type Field = { label: string; value: string };

// ── display_cards ──
export type CardItem = {
  title: string;
  subtitle?: string;
  imageUrl?: string;
  emoji?: string;
  badges?: Badge[];
  fields?: Field[];
  footer?: string;
};
export type CardsPayload = {
  title?: string;
  layout?: "grid" | "list";
  items: CardItem[];
};

// ── display_list ──
export type ListItem = {
  text: string;
  subtext?: string;
  emoji?: string;
  badge?: Badge;
};
export type ListPayload = {
  title?: string;
  ordered?: boolean;
  items: ListItem[];
};

// ── display_table ──
export type TablePayload = {
  title?: string;
  columns: string[];
  rows: string[][];
  align?: ("left" | "right" | "center")[];
};

// ── display_key_values ──
export type KeyValuesPayload = {
  title?: string;
  items: Field[];
};

// ── display_weather ──
export type ForecastDay = {
  label: string;
  high: string;
  low?: string;
  emoji?: string;
};
export type WeatherPayload = {
  location: string;
  current?: { temp: string; condition?: string; emoji?: string; feelsLike?: string };
  stats?: Field[];
  forecast?: ForecastDay[];
};

// ── display_stats ──
export type StatItem = { label: string; value: string; emoji?: string; tone?: Tone };
export type StatsPayload = {
  title?: string;
  items: StatItem[];
};

// ── display_image ──
export type ImagePayload = {
  url?: string;
  caption?: string;
  alt?: string;
  images?: { url: string; caption?: string }[];
  title?: string;
};

// ── display_map ──
export type MapPayload = {
  label: string;
  lat?: number;
  lng?: number;
  query?: string;
  zoom?: number;
};

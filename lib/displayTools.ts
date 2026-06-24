/** Rich-display client tools — Amber's screen.
 *
 * These are ordinary client-declared tools (see `lib/clientTools.ts`): declared
 * over `register_tools`, called by Amber as `client_display_*`, run here, answered
 * with a short string. Their *effect* is to push a typed widget onto the
 * conversation surface (cards, lists, tables, weather, …) so Amber can SHOW
 * structured answers while she narrates them aloud — instead of reading every
 * field. Each `run` renders the payload (via `push`) and returns a terse ack, so
 * the model knows the render landed and keeps its spoken reply a summary.
 *
 * Adding a widget = one entry here (schema + ack) + one renderer in
 * `app/components/display/` registered in `DisplaySurface`.
 */
import type { ClientTool } from "@/lib/clientTools";
import type { ToolSpec } from "@/lib/connection";
import type { DisplayBlock } from "@/lib/displayTypes";

export type { DisplayBlock } from "@/lib/displayTypes";

const OBJ = "object";
const ARR = "array";
const STR = { type: "string" } as const;

// Reusable sub-schemas (kept inline in JSON Schema form for the Anthropic API).
const badge = {
  type: OBJ,
  properties: {
    text: STR,
    tone: { type: "string", enum: ["neutral", "positive", "warning", "danger", "accent"] },
  },
  required: ["text"],
};
const field = {
  type: OBJ,
  properties: { label: STR, value: STR },
  required: ["label", "value"],
};

type Spec = ToolSpec & { ack: (input: Record<string, unknown>) => string };

/** The catalog: schema + ack message. `run` is assembled in buildDisplayTools. */
const SPECS: Spec[] = [
  {
    name: "display_cards",
    description:
      "Show a set of cards on the screen — the best way to present a list of " +
      "things with detail (matches, teams, products, places, people, options). " +
      "Each card can have a title, subtitle, an emoji (use a flag emoji like 🇧🇷 " +
      "for countries), badges, key/value fields, and a footer. Prefer this over " +
      "reading a long list aloud: render the cards and just narrate a short summary.",
    input_schema: {
      type: OBJ,
      properties: {
        title: STR,
        layout: { type: "string", enum: ["grid", "list"] },
        items: {
          type: ARR,
          items: {
            type: OBJ,
            properties: {
              title: STR,
              subtitle: STR,
              imageUrl: { type: "string", description: "Absolute https image URL (photo/logo). Prefer `emoji` for flags." },
              emoji: { type: "string", description: "Leading emoji/glyph, e.g. a flag 🇫🇷." },
              badges: { type: ARR, items: badge },
              fields: { type: ARR, items: field, description: "Key/value rows, e.g. {label:'Kickoff', value:'3 PM'}." },
              footer: STR,
            },
            required: ["title"],
          },
        },
      },
      required: ["items"],
    },
    ack: (i) => `Displayed ${len(i.items)} card(s).`,
  },
  {
    name: "display_list",
    description:
      "Show a simple list (ordered or bulleted). Use for steps, rankings, or short " +
      "items that don't need full cards. Each item can carry an emoji and a badge.",
    input_schema: {
      type: OBJ,
      properties: {
        title: STR,
        ordered: { type: "boolean" },
        items: {
          type: ARR,
          items: {
            type: OBJ,
            properties: { text: STR, subtext: STR, emoji: STR, badge },
            required: ["text"],
          },
        },
      },
      required: ["items"],
    },
    ack: (i) => `Displayed a list of ${len(i.items)} item(s).`,
  },
  {
    name: "display_table",
    description:
      "Show a table of rows and columns — use for comparisons, schedules, " +
      "standings, or any grid of values. `columns` are headers; `rows` is an array " +
      "of rows, each an array of string cells matching the columns.",
    input_schema: {
      type: OBJ,
      properties: {
        title: STR,
        columns: { type: ARR, items: STR },
        rows: { type: ARR, items: { type: ARR, items: STR } },
        align: { type: ARR, items: { type: "string", enum: ["left", "right", "center"] } },
      },
      required: ["columns", "rows"],
    },
    ack: (i) => `Displayed a table with ${len(i.rows)} row(s).`,
  },
  {
    name: "display_key_values",
    description:
      "Show a set of key/value facts — a spec sheet or quick summary (e.g. a " +
      "company's stats, a recipe's details, a definition's properties).",
    input_schema: {
      type: OBJ,
      properties: {
        title: STR,
        items: { type: ARR, items: field },
      },
      required: ["items"],
    },
    ack: (i) => `Displayed ${len(i.items)} fact(s).`,
  },
  {
    name: "display_weather",
    description:
      "Show a weather panel for a place: the current conditions, extra stats " +
      "(humidity, wind, UV…), and an optional multi-day forecast. Narrate the gist " +
      "('72 and sunny, cooler tomorrow') and let the panel carry the numbers.",
    input_schema: {
      type: OBJ,
      properties: {
        location: STR,
        current: {
          type: OBJ,
          properties: { temp: STR, condition: STR, emoji: STR, feelsLike: STR },
        },
        stats: { type: ARR, items: field },
        forecast: {
          type: ARR,
          items: {
            type: OBJ,
            properties: { label: STR, high: STR, low: STR, emoji: STR },
            required: ["label", "high"],
          },
        },
      },
      required: ["location"],
    },
    ack: (i) => `Displayed weather for ${str(i.location) || "a location"}.`,
  },
  {
    name: "display_stats",
    description:
      "Show big-number stat tiles — scores, prices, counts, metrics. Each tile is a " +
      "label, a prominent value, an optional emoji, and an optional tone (positive/" +
      "danger color it green/red, e.g. a stock up or down).",
    input_schema: {
      type: OBJ,
      properties: {
        title: STR,
        items: {
          type: ARR,
          items: {
            type: OBJ,
            properties: {
              label: STR,
              value: STR,
              emoji: STR,
              tone: { type: "string", enum: ["neutral", "positive", "warning", "danger", "accent"] },
            },
            required: ["label", "value"],
          },
        },
      },
      required: ["items"],
    },
    ack: (i) => `Displayed ${len(i.items)} stat(s).`,
  },
  {
    name: "display_image",
    description:
      "Show one image, or a gallery of images. Pass `url` (+ optional `caption`/`alt`) " +
      "for a single image, or `images` (an array of {url, caption}) for a gallery. " +
      "Use absolute https URLs.",
    input_schema: {
      type: OBJ,
      properties: {
        url: STR,
        caption: STR,
        alt: STR,
        title: STR,
        images: {
          type: ARR,
          items: {
            type: OBJ,
            properties: { url: STR, caption: STR },
            required: ["url"],
          },
        },
      },
    },
    ack: (i) => (i.images ? `Displayed a gallery of ${len(i.images)} image(s).` : "Displayed an image."),
  },
  {
    name: "display_map",
    description:
      "Show a location on a map. Provide `lat`/`lng` when known (best), or a `query` " +
      "string (a place/address) otherwise, plus a `label` for the marker. Use for " +
      "'where is…', directions, or showing a venue.",
    input_schema: {
      type: OBJ,
      properties: {
        label: STR,
        lat: { type: "number" },
        lng: { type: "number" },
        query: STR,
        zoom: { type: "number" },
      },
      required: ["label"],
    },
    ack: (i) => `Displayed a map of ${str(i.label) || "a place"}.`,
  },
];

function len(v: unknown): number {
  return Array.isArray(v) ? v.length : 0;
}
function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/** All display-tool names (handy for tests / debugging). */
export const DISPLAY_TOOL_NAMES = [...SPECS.map((s) => s.name), "clear_display"];

/**
 * Build the rich-display tool set.
 *  - `push`  appends a widget to the conversation surface.
 *  - `clear` empties it (used by `clear_display`, and `onWake` clears it too).
 */
export function buildDisplayTools(
  push: (block: Omit<DisplayBlock, "id">) => void,
  clear: () => void,
): ClientTool[] {
  const tools: ClientTool[] = SPECS.map(({ name, description, input_schema, ack }) => ({
    name,
    description,
    input_schema,
    run: async (input) => {
      const payload = (input || {}) as Record<string, unknown>;
      push({ tool: name, payload });
      return ack(payload);
    },
  }));

  tools.push({
    name: "clear_display",
    description:
      "Clear everything currently shown on the screen (cards, lists, etc.). Use when " +
      "the user is done with what's displayed or you want a clean slate.",
    input_schema: { type: OBJ, properties: {} },
    run: async () => {
      clear();
      return "Cleared the display.";
    },
  });

  return tools;
}

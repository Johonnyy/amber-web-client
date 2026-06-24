"use client";

import type { ComponentType } from "react";
import type { DisplayBlock } from "@/lib/displayTypes";
import { Cards } from "@/app/components/display/Cards";
import { List } from "@/app/components/display/List";
import { Table } from "@/app/components/display/Table";
import { KeyValues } from "@/app/components/display/KeyValues";
import { Weather } from "@/app/components/display/Weather";
import { Stats } from "@/app/components/display/Stats";
import { ImageBlock } from "@/app/components/display/ImageBlock";
import { MapBlock } from "@/app/components/display/MapBlock";

/** Maps a display tool's name to its renderer. Adding a widget = one entry here
 *  (plus its tool schema in `lib/displayTools.ts`). Payload is typed per renderer;
 *  the cast is safe because the tool that produced the block owns the shape. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const RENDERERS: Record<string, ComponentType<{ payload: any }>> = {
  display_cards: Cards,
  display_list: List,
  display_table: Table,
  display_key_values: KeyValues,
  display_weather: Weather,
  display_stats: Stats,
  display_image: ImageBlock,
  display_map: MapBlock,
};

/** Renders the stack of rich widgets Amber has shown this turn, in order. */
export function DisplaySurface({ blocks }: { blocks: DisplayBlock[] }) {
  if (!blocks.length) return null;
  return (
    <div className="d-surface">
      {blocks.map((b) => {
        const Renderer = RENDERERS[b.tool];
        if (!Renderer) return null; // unknown widget — skip defensively
        return <Renderer key={b.id} payload={b.payload} />;
      })}
    </div>
  );
}

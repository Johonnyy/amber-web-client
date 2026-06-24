"use client";

import type { KeyValuesPayload } from "@/lib/displayTypes";
import { FieldRow } from "@/app/components/display/primitives";

/** A spec sheet of label → value facts. */
export function KeyValues({ payload }: { payload: KeyValuesPayload }) {
  const items = payload.items || [];
  return (
    <div className="d-block">
      {payload.title && <h3 className="d-title">{payload.title}</h3>}
      <div className="d-kv">
        {items.map((f, i) => (
          <FieldRow field={f} key={i} />
        ))}
      </div>
    </div>
  );
}

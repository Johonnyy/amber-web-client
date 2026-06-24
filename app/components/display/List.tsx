"use client";

import type { ListPayload } from "@/lib/displayTypes";
import { BadgePill } from "@/app/components/display/primitives";

/** A simple ordered/bulleted list with optional emoji + badge per row. */
export function List({ payload }: { payload: ListPayload }) {
  const items = payload.items || [];
  return (
    <div className="d-block">
      {payload.title && <h3 className="d-title">{payload.title}</h3>}
      <ol className={`d-list${payload.ordered ? " d-list--ordered" : ""}`}>
        {items.map((it, i) => (
          <li className="d-list-item" key={i}>
            {payload.ordered ? (
              <span className="d-list-num">{i + 1}</span>
            ) : it.emoji ? (
              <span className="d-list-emoji">{it.emoji}</span>
            ) : (
              <span className="d-list-dot" />
            )}
            <span className="d-list-text">
              <span className="d-list-main">{it.text}</span>
              {it.subtext && <span className="d-list-sub">{it.subtext}</span>}
            </span>
            {it.badge && <BadgePill badge={it.badge} />}
          </li>
        ))}
      </ol>
    </div>
  );
}

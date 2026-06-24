"use client";

import type { StatsPayload } from "@/lib/displayTypes";

/** Big-number stat tiles — scores, prices, counts, metrics. */
export function Stats({ payload }: { payload: StatsPayload }) {
  const items = payload.items || [];
  return (
    <div className="d-block">
      {payload.title && <h3 className="d-title">{payload.title}</h3>}
      <div className="d-stats">
        {items.map((s, i) => (
          <div className={`d-stat d-stat--${s.tone || "neutral"}`} key={i}>
            {s.emoji && <span className="d-stat-emoji">{s.emoji}</span>}
            <span className="d-stat-value">{s.value}</span>
            <span className="d-stat-label">{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

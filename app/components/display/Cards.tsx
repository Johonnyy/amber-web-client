"use client";

import type { CardsPayload } from "@/lib/displayTypes";
import { BadgePill, FieldRow, Thumb } from "@/app/components/display/primitives";

/** A grid (or list) of detail cards — the workhorse widget. */
export function Cards({ payload }: { payload: CardsPayload }) {
  const items = payload.items || [];
  return (
    <div className="d-block">
      {payload.title && <h3 className="d-title">{payload.title}</h3>}
      <div className={`d-cards d-cards--${payload.layout || "grid"}`}>
        {items.map((c, i) => (
          <article className="d-card" key={i}>
            {(c.emoji || c.imageUrl) && (
              <div className="d-card-media">
                <Thumb emoji={c.emoji} imageUrl={c.imageUrl} alt={c.title} />
              </div>
            )}
            <div className="d-card-body">
              <div className="d-card-head">
                <span className="d-card-title">{c.title}</span>
                {c.subtitle && <span className="d-card-sub">{c.subtitle}</span>}
              </div>
              {c.badges && c.badges.length > 0 && (
                <div className="d-badges">
                  {c.badges.map((b, j) => (
                    <BadgePill badge={b} key={j} />
                  ))}
                </div>
              )}
              {c.fields && c.fields.length > 0 && (
                <div className="d-fields">
                  {c.fields.map((f, j) => (
                    <FieldRow field={f} key={j} />
                  ))}
                </div>
              )}
              {c.footer && <div className="d-card-foot">{c.footer}</div>}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

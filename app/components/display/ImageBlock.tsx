"use client";

import type { ImagePayload } from "@/lib/displayTypes";

/* eslint-disable @next/next/no-img-element */

/** A single image or a small gallery. */
export function ImageBlock({ payload }: { payload: ImagePayload }) {
  const gallery = payload.images && payload.images.length > 0 ? payload.images : null;

  return (
    <div className="d-block">
      {payload.title && <h3 className="d-title">{payload.title}</h3>}
      {gallery ? (
        <div className="d-gallery">
          {gallery.map((img, i) => (
            <figure className="d-figure" key={i}>
              <img className="d-image" src={img.url} alt={img.caption || ""} loading="lazy" />
              {img.caption && <figcaption className="d-caption">{img.caption}</figcaption>}
            </figure>
          ))}
        </div>
      ) : payload.url ? (
        <figure className="d-figure">
          <img className="d-image" src={payload.url} alt={payload.alt || payload.caption || ""} loading="lazy" />
          {payload.caption && <figcaption className="d-caption">{payload.caption}</figcaption>}
        </figure>
      ) : null}
    </div>
  );
}

"use client";

import type { MapPayload } from "@/lib/displayTypes";

/** A location on a map.
 *
 * When coordinates are given we embed an OpenStreetMap tile (keyless, no JS map
 * library — light on a Pi). Without coordinates we can't geocode client-side, so
 * we show a tidy placeholder with the place name and a search link as a fallback.
 */
export function MapBlock({ payload }: { payload: MapPayload }) {
  const hasCoords = typeof payload.lat === "number" && typeof payload.lng === "number";

  if (hasCoords) {
    const lat = payload.lat as number;
    const lng = payload.lng as number;
    // bbox tightens as zoom increases; default ~city level.
    const z = payload.zoom ?? 13;
    const d = Math.max(0.003, 0.18 / Math.pow(1.6, z - 10));
    const bbox = `${lng - d},${lat - d},${lng + d},${lat + d}`;
    const src = `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(
      bbox,
    )}&layer=mapnik&marker=${lat},${lng}`;
    return (
      <div className="d-block">
        <div className="d-map">
          <iframe className="d-map-frame" src={src} title={payload.label} loading="lazy" />
          <div className="d-map-label">📍 {payload.label}</div>
        </div>
      </div>
    );
  }

  const query = payload.query || payload.label;
  const href = `https://www.openstreetmap.org/search?query=${encodeURIComponent(query)}`;
  return (
    <div className="d-block">
      <div className="d-map d-map--placeholder">
        <span className="d-map-pin">📍</span>
        <span className="d-map-name">{payload.label}</span>
        <a className="d-map-link" href={href} target="_blank" rel="noopener noreferrer">
          Open in map
        </a>
      </div>
    </div>
  );
}

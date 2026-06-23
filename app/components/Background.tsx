"use client";

import type { Phase } from "@/lib/types";

/** The themed background.
 *
 * Renders every effect layer the themes might use; CSS (keyed off the stage's
 * `data-theme`) decides which are visible and how they animate, so the markup is
 * shared across all themes. Used twice: once as the ambient home backdrop, and
 * again inside the conversation with `intense` (brighter/faster while you talk).
 *
 *   fx-base      flat / gradient wash (every theme)
 *   fx-aurora    drifting amber blobs (aurora)
 *   fx-grid      synthwave perspective grid (retro)
 *   fx-stars     parallax starfield + nebula (space)
 *   fx-scan      CRT scanlines (retro, terminal)
 *   fx-vignette  edge darkening (most effect themes)
 */
export function Background({ phase, intense }: { phase: Phase; intense?: boolean }) {
  return (
    <div className="fx" data-phase={phase} data-intense={intense ? "true" : undefined} aria-hidden>
      <span className="fx-base" />
      <span className="fx-aurora">
        <i />
        <i />
        <i />
      </span>
      <span className="fx-grid" />
      <span className="fx-stars">
        <i />
        <i />
        <i />
      </span>
      <span className="fx-scan" />
      <span className="fx-vignette" />
    </div>
  );
}

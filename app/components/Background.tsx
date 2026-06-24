"use client";

import type { Phase } from "@/lib/types";
import type { ThemeId } from "@/lib/themes";
import { FX_FOR_THEME } from "@/app/components/fx/registry";

/** The themed background.
 *
 * Renders every CSS effect layer the themes might use; CSS (keyed off the stage's
 * `data-theme`) decides which are visible and how they animate, so the markup is
 * shared across all themes. A theme may also opt into a JS/canvas effect via the
 * fx registry (e.g. the space starfield) — that's mounted only on the home
 * backdrop instance (not the intensified conversation one) so there's a single
 * animation loop. Used twice: the ambient home backdrop, and again inside the
 * conversation with `intense` (brighter/faster while you talk).
 *
 *   fx-base      flat / gradient wash (every theme)
 *   fx-aurora    drifting amber blobs (aurora)
 *   fx-grid      synthwave perspective grid (retro)
 *   fx-sun       synthwave banded setting sun + horizon (retro)
 *   fx-stars     parallax nebula glow (space) — sharp stars come from the canvas
 *   fx-scan      CRT scanlines (retro, terminal)
 *   fx-vignette  edge darkening (most effect themes)
 */
export function Background({
  phase,
  theme,
  intense,
}: {
  phase: Phase;
  theme?: ThemeId;
  intense?: boolean;
}) {
  const Fx = theme ? FX_FOR_THEME[theme] : undefined;

  return (
    <div className="fx" data-phase={phase} data-intense={intense ? "true" : undefined} aria-hidden>
      <span className="fx-base" />
      <span className="fx-aurora">
        <i />
        <i />
        <i />
      </span>
      <span className="fx-sun">
        <i />
      </span>
      <span className="fx-grid" />
      <span className="fx-stars">
        <i />
        <i />
        <i />
      </span>
      {Fx && !intense && <Fx phase={phase} />}
      <span className="fx-scan" />
      <span className="fx-vignette" />
    </div>
  );
}

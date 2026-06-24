"use client";

import type { Phase } from "@/lib/types";

/** The reactive status orb at the centre of the idle screen.
 *
 * One element whose animation/glow is driven entirely by the current `Phase`
 * (see globals.css `.orb[data-phase=…]`). It's the ambient signal that tells
 * the user whether Amber is asleep, hearing them, thinking, or replying — no
 * text label (the phase reads from the orb's motion, and the conversation
 * surface carries the words once a turn starts).
 */
export function Orb({ phase }: { phase: Phase }) {
  return (
    <div className="orb-wrap">
      <div className="orb" data-phase={phase}>
        <span className="orb-core" />
      </div>
    </div>
  );
}

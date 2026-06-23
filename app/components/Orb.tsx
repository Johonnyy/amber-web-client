"use client";

import type { Phase } from "@/lib/types";

const LABELS: Record<Phase, string> = {
  idle: "Say “Amber”",
  listening: "Listening…",
  thinking: "Thinking…",
  speaking: "Speaking…",
};

/** The reactive status orb beneath the clock.
 *
 * One element whose animation/glow is driven entirely by the current `Phase`
 * (see globals.css `.orb[data-phase=…]`). It's the ambient signal that tells
 * the user whether Amber is asleep, hearing them, thinking, or replying.
 */
export function Orb({ phase, label }: { phase: Phase; label?: string }) {
  return (
    <div className="orb-wrap">
      <div className="orb" data-phase={phase}>
        <span className="orb-core" />
      </div>
      <div className="orb-label" data-phase={phase}>
        {label ?? LABELS[phase]}
      </div>
    </div>
  );
}

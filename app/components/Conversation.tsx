"use client";

import type { Phase } from "@/lib/types";

/** The full-screen, fluid conversation surface.
 *
 * Always mounted so it can both fade *in* (when a turn starts) and fade *out*
 * (back to idle). While active it takes over the whole screen with drifting
 * liquid light; your words appear live as you speak, then Amber's reply streams
 * in sentence by sentence, each one blurring softly into place.
 */
export function Conversation({
  phase,
  you,
  sentences,
  error,
}: {
  phase: Phase;
  you: string;
  sentences: string[];
  error: string;
}) {
  const active = phase !== "idle";
  const speaking = phase === "speaking";
  const waiting = phase === "thinking" && sentences.length === 0;

  return (
    <div
      className={`convo-full${active ? " is-active" : ""}`}
      data-phase={phase}
      aria-hidden={!active}
    >
      {/* drifting liquid light */}
      <div className="liquid" aria-hidden>
        <span className="blob blob-a" />
        <span className="blob blob-b" />
        <span className="blob blob-c" />
      </div>

      <div className="convo-content">
        {/* What you said — hero while listening, a quiet caption while Amber replies */}
        {(you || phase === "listening") && (
          <p className="you-line" data-small={speaking}>
            {you || "Listening…"}
          </p>
        )}

        {/* Amber's reply */}
        <div className="amber-line">
          {waiting ? (
            <span className="thinking-dots" aria-label="Thinking">
              <span />
              <span />
              <span />
            </span>
          ) : (
            sentences.map((s, i) => (
              <span className="sentence" key={i}>
                {s}{" "}
              </span>
            ))
          )}
        </div>

        {error && <p className="convo-error">{error}</p>}
      </div>
    </div>
  );
}

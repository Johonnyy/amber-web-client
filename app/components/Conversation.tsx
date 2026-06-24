"use client";

import type { Phase } from "@/lib/types";
import type { ThemeId } from "@/lib/themes";
import type { DisplayBlock } from "@/lib/displayTypes";
import { Background } from "@/app/components/Background";
import { DisplaySurface } from "@/app/components/display/DisplaySurface";

/** The full-screen, fluid conversation surface.
 *
 * Always mounted so it can both fade *in* (when a turn starts) and fade *out*
 * (back to idle). While active it takes over the whole screen with the theme's
 * drifting light; your words appear live as you speak, then Amber replies.
 *
 * Amber's reply has two forms. The default is text — her sentences stream in and
 * blur softly into place. But if she renders rich widgets (cards, tables, …) via
 * her display tools, those take over the surface and the text captions are
 * hidden — the spoken audio still plays, so you *hear* the answer and *see* the
 * organized version. ("Text is the default; if there's a widget, show that.")
 */
export function Conversation({
  phase,
  theme,
  you,
  sentences,
  blocks,
  error,
}: {
  phase: Phase;
  theme: ThemeId;
  you: string;
  sentences: string[];
  blocks: DisplayBlock[];
  error: string;
}) {
  const active = phase !== "idle";
  const speaking = phase === "speaking";
  const waiting = phase === "thinking" && sentences.length === 0 && blocks.length === 0;
  const hasWidgets = blocks.length > 0;

  return (
    <div
      className={`convo-full${active ? " is-active" : ""}`}
      data-phase={phase}
      data-has-widgets={hasWidgets ? "true" : undefined}
      aria-hidden={!active}
    >
      {/* the theme's own background, intensified while talking */}
      <Background phase={phase} theme={theme} intense />

      <div className="convo-content">
        {/* What you said — hero while listening, a quiet caption while Amber replies */}
        {(you || phase === "listening") && (
          <p className="you-line" data-small={speaking || hasWidgets}>
            {you || "Listening…"}
          </p>
        )}

        {/* Rich widgets take precedence; otherwise Amber's streamed text. */}
        {hasWidgets ? (
          <DisplaySurface blocks={blocks} />
        ) : (
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
        )}

        {error && <p className="convo-error">{error}</p>}
      </div>
    </div>
  );
}

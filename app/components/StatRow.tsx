"use client";

import type { ConnState } from "@/lib/types";

const CONN_LABEL: Record<ConnState, string> = {
  disconnected: "offline",
  connecting: "connecting…",
  connected: "online",
  error: "error",
};

/** The ambient stat strip along the bottom of the screen.
 *
 * A calm, glanceable read on the system: connection, perceived latency, whether
 * the mic is armed for the wake word, and how many memory facts Amber drew on
 * last turn. Replaces the old "Press Esc for settings" hint. Dims (never fully
 * hides) during an active turn so it stays a quiet background detail.
 */
export function StatRow({
  connState,
  note,
  latency,
  micArmed,
  facts,
  active,
}: {
  connState: ConnState;
  note?: string;
  latency: number | null;
  micArmed: boolean;
  facts: number;
  active: boolean;
}) {
  return (
    <div className="statrow" data-active={active} aria-hidden={active}>
      <span className={`stat conn conn--${connState}`}>
        <span className="conn-dot" />
        {CONN_LABEL[connState]}
        {note ? ` · ${note}` : ""}
      </span>

      {latency != null && (
        <span className="stat">
          <span className="stat-key">latency</span>
          {latency} ms
        </span>
      )}

      {micArmed && (
        <span className="stat stat--mic">
          <span className="stat-mic-dot" />
          mic live
        </span>
      )}

      {facts > 0 && (
        <span className="stat">
          <span className="stat-key">memory</span>
          {facts} {facts === 1 ? "fact" : "facts"}
        </span>
      )}
    </div>
  );
}

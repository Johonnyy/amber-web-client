"use client";

import { useState } from "react";
import type { Settings } from "@/lib/settings";

/** The Escape-key settings overlay.
 *
 * Edits a local draft so changes aren't applied until Save; on Save the parent
 * persists them and reconnects if the endpoint changed. Cancel/Escape discards.
 */
export function SettingsPanel({
  settings,
  onSave,
  onClose,
}: {
  settings: Settings;
  onSave: (s: Settings) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Settings>(settings);

  const set = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(draft);
  };

  return (
    <div className="settings-backdrop" onClick={onClose}>
      <form className="settings" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <header className="settings-head">
          <h2>Settings</h2>
          <button type="button" className="settings-x" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>

        <label className="field">
          <span>Amber host</span>
          <input
            type="text"
            value={draft.host}
            onChange={(e) => set("host", e.target.value)}
            placeholder="ws://localhost:8000/ws"
            spellCheck={false}
            autoFocus
          />
        </label>

        <label className="field">
          <span>Auth token</span>
          <input
            type="password"
            value={draft.token}
            onChange={(e) => set("token", e.target.value)}
            placeholder="(optional shared secret)"
            spellCheck={false}
          />
        </label>

        <label className="field">
          <span>Update token</span>
          <input
            type="password"
            value={draft.updateToken}
            onChange={(e) => set("updateToken", e.target.value)}
            placeholder="(authorizes voice self-update)"
            spellCheck={false}
          />
          <small>Must match the host&rsquo;s AMBER_UPDATE_TOKEN. Lets you say “Amber, update yourself.”</small>
        </label>

        <label className="field">
          <span>Wake words</span>
          <input
            type="text"
            value={draft.wakeWords}
            onChange={(e) => set("wakeWords", e.target.value)}
            placeholder="amber, hey amber, ok amber"
            spellCheck={false}
          />
          <small>Comma-separated. A heard phrase containing any of these starts a turn.</small>
        </label>

        <div className="field-row">
          <label className="field">
            <span>End-of-speech silence (ms)</span>
            <input
              type="number"
              min={300}
              max={5000}
              step={100}
              value={draft.silenceMs}
              onChange={(e) => set("silenceMs", Number(e.target.value))}
            />
          </label>
          <label className="field">
            <span>Max utterance (ms)</span>
            <input
              type="number"
              min={3000}
              max={60000}
              step={1000}
              value={draft.maxUtteranceMs}
              onChange={(e) => set("maxUtteranceMs", Number(e.target.value))}
            />
          </label>
        </div>

        <label className="field-check">
          <input
            type="checkbox"
            checked={draft.clock24h}
            onChange={(e) => set("clock24h", e.target.checked)}
          />
          <span>24-hour clock</span>
        </label>

        <label className="field-check">
          <input
            type="checkbox"
            checked={draft.autoConnect}
            onChange={(e) => set("autoConnect", e.target.checked)}
          />
          <span>Connect automatically on wake</span>
        </label>

        <footer className="settings-foot">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary">
            Save
          </button>
        </footer>
      </form>
    </div>
  );
}

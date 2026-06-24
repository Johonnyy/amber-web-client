"use client";

import { useState } from "react";
import type { Settings } from "@/lib/settings";
import {
  CLOCK_POSITIONS,
  DATE_FORMATS,
  THEMES,
  type ClockPosition,
} from "@/lib/themes";

/** The settings overlay (opened by 5 taps anywhere, or Escape).
 *
 * Two kinds of settings:
 *  - **Appearance** (theme, clock, date) applies *instantly* via `onLiveChange` —
 *    pure-render changes you can preview without saving — and is read straight
 *    from the live `settings` prop.
 *  - **Connection / Voice** edits a local draft and only commits on Save (these
 *    can trigger a reconnect, so they shouldn't fire on every keystroke).
 * Cancel/Escape discards the unsaved draft; live appearance changes already stuck.
 */
export function SettingsPanel({
  settings,
  onSave,
  onLiveChange,
  onClose,
}: {
  settings: Settings;
  onSave: (s: Settings) => void;
  onLiveChange: (patch: Partial<Settings>) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Settings>(settings);

  // Draft setter for save-required (connection/voice) fields.
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  // Live setter for appearance fields: apply+persist immediately, and keep the
  // draft in sync so Save (which commits the draft) doesn't clobber the change.
  const live = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    onLiveChange({ [key]: value } as Partial<Settings>);
  };

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

        {/* ─────────── Appearance ─────────── */}
        <p className="settings-section">Appearance</p>

        <div className="field">
          <span>Theme</span>
          <div className="theme-grid">
            {THEMES.map((t) => (
              <button
                type="button"
                key={t.id}
                className={`theme-chip theme-chip--${t.id}`}
                aria-pressed={settings.theme === t.id}
                onClick={() => live("theme", t.id)}
                title={t.blurb}
              >
                <span className="theme-swatch" />
                <span className="theme-name">{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <span>Clock position</span>
          <div className="pos-grid" role="group" aria-label="Clock position">
            {CLOCK_POSITIONS.map((pos: ClockPosition) => (
              <button
                type="button"
                key={pos}
                className="pos-cell"
                aria-pressed={settings.clockPosition === pos}
                aria-label={pos.replace("-", " ")}
                onClick={() => live("clockPosition", pos)}
              >
                <span className="pos-dot" />
              </button>
            ))}
          </div>
        </div>

        <label className="field">
          <span>Date format</span>
          <select
            value={settings.dateFormat}
            onChange={(e) => live("dateFormat", e.target.value as Settings["dateFormat"])}
          >
            {DATE_FORMATS.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>
        </label>

        <div className="field-row">
          <label className="field-check">
            <input
              type="checkbox"
              checked={settings.clock24h}
              onChange={(e) => live("clock24h", e.target.checked)}
            />
            <span>24-hour clock</span>
          </label>
          <label className="field-check">
            <input
              type="checkbox"
              checked={settings.showSeconds}
              onChange={(e) => live("showSeconds", e.target.checked)}
            />
            <span>Show seconds</span>
          </label>
        </div>

        {/* ─────────── Connection ─────────── */}
        <p className="settings-section">Connection</p>

        <label className="field">
          <span>Amber host</span>
          <input
            type="text"
            value={draft.host}
            onChange={(e) => set("host", e.target.value)}
            placeholder="ws://localhost:8000/ws"
            spellCheck={false}
          />
        </label>

        <div className="field-row">
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
              placeholder="(voice self-update)"
              spellCheck={false}
            />
          </label>
        </div>

        <label className="field-check">
          <input
            type="checkbox"
            checked={draft.autoConnect}
            onChange={(e) => set("autoConnect", e.target.checked)}
          />
          <span>Connect automatically on wake</span>
        </label>

        {/* ─────────── Voice ─────────── */}
        <p className="settings-section">Voice</p>

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

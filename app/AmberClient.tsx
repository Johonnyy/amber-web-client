"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AmberConnection, MSG, type Frame } from "@/lib/connection";
import { buildClientTools, type ClientTool } from "@/lib/clientTools";
import { AudioQueue } from "@/lib/audioQueue";
import { MicRecorder } from "@/lib/recorder";
import { SpeechEngine } from "@/lib/speech";
import { loadSettings, matchesWake, saveSettings, type Settings } from "@/lib/settings";
import type { ConnState, Phase } from "@/lib/types";
import { Clock } from "@/app/components/Clock";
import { Orb } from "@/app/components/Orb";
import { Conversation } from "@/app/components/Conversation";
import { SettingsPanel } from "@/app/components/SettingsPanel";

const now = () => performance.now();
const VAD_TICK_MS = 150;
const NO_SPEECH_TIMEOUT_MS = 6000; // wake heard but no command → give up
const MIN_CAPTURE_MS = 600; // ignore silence-end before this much has elapsed
const LINGER_MS = 3000; // keep the reply on screen this long before fading home

/**
 * The whole hands-free voice loop, wired together.
 *
 *   idle ──(wake word)──► listening ──(VAD silence)──► thinking ──► speaking ──► idle
 *
 * The imperative engines (mic, speech recognition, WebSocket, audio playback)
 * live in refs; React state is just their projection for rendering. `phaseRef`
 * mirrors `phase` so the engine callbacks always read the live value.
 */
export function AmberClient() {
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [phase, setPhase] = useState<Phase>("idle");
  const [connState, setConnState] = useState<ConnState>("disconnected");
  const [statusNote, setStatusNote] = useState("");
  const [activated, setActivated] = useState(false);
  const [unsupported, setUnsupported] = useState(false);
  const [transcript, setTranscript] = useState(""); // what STT heard (after send)
  const [liveTranscript, setLiveTranscript] = useState(""); // interim, while you speak
  const [sentences, setSentences] = useState<string[]>([]); // Amber's reply, per sentence
  const [error, setError] = useState("");
  const [updating, setUpdating] = useState(false); // self-update in progress
  const [settingsOpen, setSettingsOpen] = useState(false);

  const conn = useRef<AmberConnection | null>(null);
  const audio = useRef<AudioQueue | null>(null);
  const mic = useRef<MicRecorder | null>(null);
  const speech = useRef<SpeechEngine | null>(null);

  // Refs mirror state for the imperative engine callbacks. They're only ever
  // written from callbacks/effects (never during render): `phaseRef` via
  // setPhaseSafe, `settingsRef` via onSaveSettings, `connectRef` via an effect.
  const phaseRef = useRef<Phase>(phase);
  const settingsRef = useRef<Settings>(settings);
  const connectRef = useRef<() => void>(() => {});
  // Client-declared tools Amber can call by voice (update / version), built once
  // on activation. The update token is read live so editing it in Settings takes
  // effect without re-registering.
  const clientTools = useRef<ClientTool[]>([]);

  const lastSpeech = useRef(0);
  const captureStart = useRef(0);
  const heardSpeech = useRef(false);
  const vadTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const turnActive = useRef(false); // a reply is streaming (thinking or speaking)
  const lingerTimer = useRef<ReturnType<typeof setTimeout> | null>(null); // reply hold-on-screen
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setPhaseSafe = useCallback((p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  }, []);

  // ───────────────────────── end-of-speech (VAD) ─────────────────────────
  const clearVad = useCallback(() => {
    if (vadTimer.current) {
      clearInterval(vadTimer.current);
      vadTimer.current = null;
    }
  }, []);

  const finishTurn = useCallback(() => {
    turnActive.current = false;
    // Let the finished reply rest on screen for a beat, then fade home. The
    // linger is interruptible — a fresh wake word cancels it (see onWake). The
    // text is cleared on the next wake, not here, so it stays put while fading.
    if (phaseRef.current === "thinking" || phaseRef.current === "speaking") {
      if (lingerTimer.current) clearTimeout(lingerTimer.current);
      lingerTimer.current = setTimeout(() => {
        lingerTimer.current = null;
        setPhaseSafe("idle");
      }, LINGER_MS);
    }
  }, [setPhaseSafe]);

  const endCapture = useCallback(async () => {
    clearVad();
    setPhaseSafe("thinking");
    const blob = await mic.current?.stop();
    if (!blob || blob.size === 0 || !conn.current?.isOpen) {
      setPhaseSafe("idle");
      return;
    }
    turnActive.current = true;
    const buf = await blob.arrayBuffer();
    conn.current.sendAudio(buf);
  }, [clearVad, setPhaseSafe]);

  const cancelCapture = useCallback(async () => {
    clearVad();
    await mic.current?.stop();
    setPhaseSafe("idle");
  }, [clearVad, setPhaseSafe]);

  const startVad = useCallback(() => {
    clearVad();
    vadTimer.current = setInterval(() => {
      if (phaseRef.current !== "listening") return;
      const s = settingsRef.current;
      const elapsed = now() - captureStart.current;
      if (elapsed > s.maxUtteranceMs) {
        void endCapture();
      } else if (!heardSpeech.current && elapsed > NO_SPEECH_TIMEOUT_MS) {
        void cancelCapture();
      } else if (
        heardSpeech.current &&
        elapsed > MIN_CAPTURE_MS &&
        now() - lastSpeech.current > s.silenceMs
      ) {
        void endCapture();
      }
    }, VAD_TICK_MS);
  }, [cancelCapture, clearVad, endCapture]);

  // wake word heard while idle (or during the post-reply linger) → start a turn
  const onWake = useCallback(() => {
    if (phaseRef.current !== "idle" && !lingerTimer.current) return;
    if (lingerTimer.current) {
      clearTimeout(lingerTimer.current);
      lingerTimer.current = null;
    }
    setError("");
    setTranscript("");
    setLiveTranscript("");
    setSentences([]);
    setPhaseSafe("listening");
    heardSpeech.current = false;
    captureStart.current = now();
    lastSpeech.current = now();
    void mic.current?.start();
    startVad();
  }, [setPhaseSafe, startVad]);

  // ───────────────────────── speech recognition ─────────────────────────
  const onSpeechResult = useCallback(
    (text: string) => {
      const p = phaseRef.current;
      // Eligible to wake while idle, or during the post-reply linger (so you can
      // immediately ask a follow-up). Never while actively listening/thinking/
      // speaking — that avoids Amber's own voice self-triggering.
      if (p === "idle" || lingerTimer.current) {
        if (matchesWake(text, settingsRef.current)) onWake();
      } else if (p === "listening") {
        lastSpeech.current = now();
        if (now() - captureStart.current > 250) {
          heardSpeech.current = true;
          setLiveTranscript(text); // surface your words live, as you speak
        }
      }
    },
    [onWake],
  );

  // Amber asked the client to run one of its declared tools. The name arrives
  // `client_`-prefixed (e.g. client_update); match it back to our bare name,
  // run it, and answer with a tool_result.
  const dispatchTool = useCallback(async (id: string, name: string, input: Frame) => {
    const bare = String(name).replace(/^client_/, "");
    const tool = clientTools.current.find((t) => t.name === bare);
    if (!tool) {
      conn.current?.toolResult(id, `Unknown client tool: ${name}`, true);
      return;
    }
    if (tool.name === "update") setUpdating(true);
    try {
      const result = await tool.run(input || {});
      conn.current?.toolResult(id, result, false);
    } catch (e) {
      if (tool.name === "update") setUpdating(false);
      conn.current?.toolResult(id, e instanceof Error ? e.message : String(e), true);
    }
  }, []);

  // ───────────────────────── connection frames ─────────────────────────
  const onJson = useCallback(
    (msg: Frame) => {
      switch (msg.type) {
        case MSG.READY:
          if (msg.session_id && conn.current) conn.current.sessionId = msg.session_id;
          // Declare our voice-callable tools (update / version) for this session.
          conn.current?.registerTools(
            clientTools.current.map(({ name, description, input_schema }) => ({
              name,
              description,
              input_schema,
            })),
          );
          break;
        case MSG.TOOL_CALL:
          void dispatchTool(msg.id, msg.name, msg.input);
          break;
        case MSG.TRANSCRIPT:
          setTranscript(msg.text || "");
          break;
        case MSG.THINKING:
          turnActive.current = !!msg.active;
          if (msg.active) setPhaseSafe("thinking");
          break;
        case MSG.AUDIO_CHUNK:
          if (msg.text) {
            const line = String(msg.text).trim();
            setSentences((s) => [...s, line]);
          }
          break;
        case MSG.TURN_COMPLETE:
          turnActive.current = false;
          if (!audio.current?.isActive) finishTurn();
          break;
        case MSG.ERROR:
          setError(msg.message || "Something went wrong this turn.");
          audio.current?.stop();
          finishTurn();
          break;
        // MEMORY and any future additive frames are ignored — advisory only.
      }
    },
    [dispatchTool, finishTurn, setPhaseSafe],
  );

  const onAudio = useCallback((buffer: ArrayBuffer, meta: Frame | null) => {
    audio.current?.enqueue(buffer, (meta?.format as string) || "mp3");
  }, []);

  // ───────────────────────── connect / reconnect ─────────────────────────
  const connect = useCallback(() => {
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }
    const s = settingsRef.current;
    const c = new AmberConnection({
      onStatus: (state, note) => {
        setConnState(state);
        setStatusNote(note ?? "");
        if (state === "disconnected" && !c.manualClose) {
          // unexpected drop — retry; the session id replays to resume.
          reconnectTimer.current = setTimeout(() => connectRef.current(), 3000);
        }
      },
      onJson,
      onAudio,
    });
    // keep the session id across reconnects
    if (conn.current) c.sessionId = conn.current.sessionId;
    conn.current = c;
    c.connect(s.host, s.token);
  }, [onAudio, onJson]);

  // ───────────────────────── activation (first gesture) ─────────────────────────
  const activate = useCallback(async () => {
    if (activated) return;
    setActivated(true);

    clientTools.current = buildClientTools(() => settingsRef.current.updateToken);

    audio.current = new AudioQueue();
    audio.current.onStateChange = (isPlaying) => {
      if (isPlaying) {
        setPhaseSafe("speaking");
      } else if (!audio.current?.isActive && !turnActive.current) {
        finishTurn();
      }
    };

    mic.current = new MicRecorder();
    try {
      await mic.current.ensureStream();
    } catch (e) {
      setError("Microphone blocked — allow mic access and reload. " + (e instanceof Error ? e.message : ""));
    }

    speech.current = new SpeechEngine({
      onResult: onSpeechResult,
      onError: (err) => {
        if (err === "not-allowed" || err === "service-not-allowed") {
          setError("Microphone permission denied for speech recognition.");
        }
      },
    });
    if (!speech.current.supported) {
      setUnsupported(true);
    } else {
      speech.current.start();
    }

    if (settingsRef.current.autoConnect) connect();
  }, [activated, connect, finishTurn, onSpeechResult, setPhaseSafe]);

  // ───────────────────────── lifecycle ─────────────────────────
  // Keep the reconnect timer pointed at the latest `connect` without making
  // `connect` reference itself (which the compiler-aware lint forbids).
  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  // Escape toggles settings; it does not interrupt the voice loop.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setSettingsOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    return () => {
      clearVad();
      if (lingerTimer.current) clearTimeout(lingerTimer.current);
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      speech.current?.stop();
      audio.current?.stop();
      mic.current?.release();
      conn.current?.disconnect();
    };
  }, [clearVad]);

  const onSaveSettings = useCallback(
    (next: Settings) => {
      const prev = settingsRef.current;
      setSettings(next);
      settingsRef.current = next;
      saveSettings(next);
      setSettingsOpen(false);
      // Reconnect if the endpoint changed and we're already live.
      if (activated && (next.host !== prev.host || next.token !== prev.token)) {
        conn.current?.disconnect();
        connect();
      } else if (activated && next.autoConnect && !conn.current?.isOpen) {
        connect();
      }
    },
    [activated, connect],
  );

  // ───────────────────────── render ─────────────────────────
  const connLabel: Record<ConnState, string> = {
    disconnected: "offline",
    connecting: "connecting…",
    connected: "online",
    error: "error",
  };

  const active = phase !== "idle";

  return (
    <main className="stage" data-phase={phase}>
      <div className="ambient" data-phase={phase} aria-hidden />

      <div className="topbar" data-active={active}>
        <span className={`conn conn--${connState}`}>
          <span className="conn-dot" />
          {connLabel[connState]}
          {statusNote ? ` · ${statusNote}` : ""}
        </span>
        <button className="gear" onClick={() => setSettingsOpen(true)} aria-label="Settings">
          ⚙
        </button>
      </div>

      {/* Home: clock + orb. Recedes while a conversation is on screen. */}
      <div className="center" data-active={active}>
        <Clock clock24h={settings.clock24h} />
        {activated ? (
          <Orb phase={phase} />
        ) : (
          <button className="wake-cta" onClick={activate}>
            <span className="wake-cta-ring" />
            Tap to wake Amber
          </button>
        )}
      </div>

      {/* Full-screen fluid conversation, fades in while talking to Amber. */}
      <Conversation
        phase={phase}
        you={transcript || liveTranscript}
        sentences={sentences}
        error={error}
      />

      {unsupported && !active && (
        <div className="notice">
          Wake-word listening needs the Web Speech API — use Chrome or Edge.
        </div>
      )}

      <div className="hint" data-active={active}>
        Press Esc for settings
      </div>

      {updating && (
        <div className="updating">
          <span className="updating-orb" />
          <p className="updating-title">Updating Amber</p>
          <p className="updating-sub">Pulling the latest, rebuilding — the screen will refresh.</p>
        </div>
      )}

      {settingsOpen && (
        <SettingsPanel
          settings={settings}
          onSave={onSaveSettings}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </main>
  );
}

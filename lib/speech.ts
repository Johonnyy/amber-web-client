/** Local speech recognition — the wake-word + voice-activity engine.
 *
 * Wraps the browser's Web Speech API (Chrome's webkitSpeechRecognition). It runs
 * continuously and streams interim transcripts back to the orchestrator, which
 * uses them for two things: detecting the wake word while idle, and detecting
 * "the user is still talking" while recording a command (so VAD can decide when
 * they've stopped). It produces no audio — the MicRecorder captures the bytes
 * Amber actually transcribes; this engine only drives timing on-device.
 *
 * Auto-restarts itself: the API ends a session after a pause or ~60s, so we
 * relaunch on `end` as long as the engine is meant to be running.
 */

// Minimal typings — the Web Speech API isn't in the standard TS DOM lib.
interface SpeechRecognitionAlternativeLike {
  transcript: string;
}
interface SpeechRecognitionResultLike {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
}
interface SpeechRecognitionEventLike {
  readonly resultIndex: number;
  readonly results: {
    readonly length: number;
    [index: number]: SpeechRecognitionResultLike;
  };
}
interface SpeechRecognitionErrorEventLike {
  readonly error: string;
}
interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export type SpeechHandlers = {
  /** A transcript update (interim or final). `transcript` is the latest text. */
  onResult: (transcript: string, isFinal: boolean) => void;
  /** A non-recoverable error (e.g. permission denied). */
  onError?: (error: string) => void;
};

export class SpeechEngine {
  private rec: SpeechRecognitionLike | null = null;
  private want = false;
  readonly supported: boolean;

  constructor(private h: SpeechHandlers) {
    const Ctor = getCtor();
    this.supported = !!Ctor;
    if (!Ctor) return;
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";

    rec.onresult = (e) => {
      // Concatenate everything from this event's start index — the freshest text.
      let text = "";
      let isFinal = false;
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        text += r[0]?.transcript ?? "";
        isFinal = r.isFinal;
      }
      const trimmed = text.trim();
      if (trimmed) this.h.onResult(trimmed, isFinal);
    };

    rec.onend = () => {
      // The API stops on its own; relaunch to stay always-listening.
      if (this.want) this.safeStart();
    };

    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        this.want = false;
        this.h.onError?.(e.error);
      }
      // 'no-speech' / 'aborted' / 'network' are transient — onend will restart.
    };

    this.rec = rec;
  }

  private safeStart(): void {
    try {
      this.rec?.start();
    } catch {
      /* already started — ignore the InvalidStateError */
    }
  }

  start(): void {
    if (!this.rec) return;
    this.want = true;
    this.safeStart();
  }

  stop(): void {
    this.want = false;
    try {
      this.rec?.stop();
    } catch {
      /* not running */
    }
  }
}

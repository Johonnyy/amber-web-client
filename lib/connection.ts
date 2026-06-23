/** The WebSocket connection to Amber — the client half of the wire protocol.
 *
 * Mirrors `app/protocol.py` in the backend; treat these message shapes as a
 * stable public contract (see ../amber-web-dev-client for the reference impl).
 *
 *   client -> server
 *     • binary frame            one complete recorded utterance (webm/opus)
 *     • {type:"interrupt"}      stop speaking the current turn
 *
 *   server -> client
 *     • {type:"ready", session_id?}             handshake accepted
 *     • {type:"transcript", text}               what STT heard
 *     • {type:"thinking", active}               generating / done
 *     • {type:"audio_chunk", index, text, format}  metadata for the NEXT binary frame
 *     • <binary frame>                          one synthesized sentence
 *     • {type:"turn_complete", sentences}       full reply sent
 *     • {type:"memory", items}                  facts in play this turn (advisory)
 *     • {type:"error", message, code?}          turn failed
 */

export const MSG = {
  READY: "ready",
  TRANSCRIPT: "transcript",
  THINKING: "thinking",
  AUDIO_CHUNK: "audio_chunk",
  TURN_COMPLETE: "turn_complete",
  MEMORY: "memory",
  TOOL_CALL: "tool_call", // server asks the client to run one of its declared tools
  ERROR: "error",
  INTERRUPT: "interrupt",
  REGISTER_TOOLS: "register_tools", // client declares tools Amber may call on it
  TOOL_RESULT: "tool_result", // client returns the result of a tool_call
} as const;

/** A tool the client declares to Amber (name is prefixed with `client_` server-side). */
export type ToolSpec = {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Frame = Record<string, any>;

export type ConnHandlers = {
  onStatus: (state: "connecting" | "connected" | "disconnected" | "error", note?: string) => void;
  onJson: (msg: Frame) => void;
  onAudio: (buffer: ArrayBuffer, meta: Frame | null) => void;
};

export class AmberConnection {
  private ws: WebSocket | null = null;
  private pendingChunk: Frame | null = null; // last audio_chunk meta, paired with next binary frame
  manualClose = false;

  /** Session id handed back in the `ready` frame; replayed on reconnect to resume. */
  sessionId: string | null = null;

  constructor(private h: ConnHandlers) {}

  connect(baseUrl: string, token: string): void {
    this.manualClose = false;
    let url = baseUrl.trim();
    const params: string[] = [];
    if (token) params.push("token=" + encodeURIComponent(token));
    if (this.sessionId) params.push("session_id=" + encodeURIComponent(this.sessionId));
    if (params.length) url += (url.includes("?") ? "&" : "?") + params.join("&");

    this.h.onStatus("connecting");
    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch (err) {
      this.h.onStatus("error", err instanceof Error ? err.message : "bad URL");
      return;
    }
    ws.binaryType = "arraybuffer";
    this.ws = ws;

    ws.addEventListener("open", () => this.h.onStatus("connected"));
    ws.addEventListener("close", (e) => {
      this.ws = null;
      this.pendingChunk = null;
      this.h.onStatus("disconnected", this.manualClose ? undefined : `closed (${e.code})`);
    });
    ws.addEventListener("error", () => this.h.onStatus("error", "socket error"));
    ws.addEventListener("message", (e) => this.onMessage(e.data));
  }

  private onMessage(data: string | ArrayBuffer): void {
    if (typeof data === "string") {
      let msg: Frame;
      try {
        msg = JSON.parse(data);
      } catch {
        return;
      }
      // Remember audio metadata so we can pair it with the binary frame that follows.
      if (msg.type === MSG.AUDIO_CHUNK) this.pendingChunk = msg;
      this.h.onJson(msg);
    } else {
      const meta = this.pendingChunk;
      this.pendingChunk = null;
      this.h.onAudio(data, meta);
    }
  }

  send(obj: Frame): void {
    if (this.isOpen) this.ws!.send(JSON.stringify(obj));
  }

  sendAudio(buffer: ArrayBuffer): void {
    if (this.isOpen) this.ws!.send(buffer);
  }

  /** Declare the tools this client can run, so Amber can call them by voice. */
  registerTools(tools: ToolSpec[]): void {
    this.send({ type: MSG.REGISTER_TOOLS, tools });
  }

  /** Return the result of a `tool_call` Amber asked us to run. */
  toolResult(id: string, content: string, isError = false): void {
    this.send({ type: MSG.TOOL_RESULT, id, content, is_error: isError });
  }

  disconnect(): void {
    this.manualClose = true;
    this.ws?.close(1000, "client disconnect");
  }

  get isOpen(): boolean {
    return !!this.ws && this.ws.readyState === WebSocket.OPEN;
  }
}

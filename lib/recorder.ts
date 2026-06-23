/** Microphone capture for one user turn.
 *
 * Holds a single getUserMedia stream open for the life of the session; each
 * `start()`/`stop()` cycle produces one webm/opus blob (the format Whisper
 * expects on the backend). End-of-speech detection lives in the orchestrator
 * (it watches the speech engine); this class is just the tape recorder.
 */
export class MicRecorder {
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private mime = "";

  /** Open the mic once (prompts for permission). Safe to call repeatedly. */
  async ensureStream(): Promise<void> {
    if (this.stream) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("getUserMedia unavailable — serve over https or localhost");
    }
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.mime =
      ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", ""].find(
        (t) => t === "" || MediaRecorder.isTypeSupported(t),
      ) ?? "";
  }

  async start(): Promise<void> {
    await this.ensureStream();
    this.chunks = [];
    this.recorder = this.mime
      ? new MediaRecorder(this.stream!, { mimeType: this.mime })
      : new MediaRecorder(this.stream!);
    this.recorder.addEventListener("dataavailable", (e) => {
      if (e.data && e.data.size > 0) this.chunks.push(e.data);
    });
    this.recorder.start();
  }

  /** Stop recording and resolve with the captured blob (null if nothing/idle). */
  stop(): Promise<Blob | null> {
    return new Promise((resolve) => {
      const rec = this.recorder;
      if (!rec || rec.state === "inactive") {
        resolve(null);
        return;
      }
      rec.addEventListener(
        "stop",
        () => {
          const blob = this.chunks.length
            ? new Blob(this.chunks, { type: rec.mimeType || "audio/webm" })
            : null;
          this.chunks = [];
          resolve(blob);
        },
        { once: true },
      );
      rec.stop();
    });
  }

  get recording(): boolean {
    return !!this.recorder && this.recorder.state === "recording";
  }

  release(): void {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.recorder = null;
  }
}

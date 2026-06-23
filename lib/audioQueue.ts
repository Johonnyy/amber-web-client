/** Plays Amber's reply, one sentence-mp3 at a time, strictly in order.
 *
 * Amber streams its reply as a series of binary frames — one synthesized
 * sentence each. Playing them back to back makes the reply sound continuous.
 * `stop()` clears everything for interrupt / barge-in.
 *
 * Ported from the vanilla dev client; behaviour is identical.
 */
export class AudioQueue {
  private queue: { buffer: ArrayBuffer; format: string }[] = [];
  private current: HTMLAudioElement | null = null;
  private currentUrl: string | null = null;
  private playing = false;

  /** Notified whenever playback starts (true) or the queue fully drains (false). */
  onStateChange: ((isPlaying: boolean) => void) | null = null;

  enqueue(buffer: ArrayBuffer, format = "mp3"): void {
    this.queue.push({ buffer, format });
    this.tick();
  }

  private tick(): void {
    if (this.playing || this.queue.length === 0) return;
    const { buffer, format } = this.queue.shift()!;
    const blob = new Blob([buffer], { type: `audio/${format}` });
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);

    this.current = audio;
    this.currentUrl = url;
    this.playing = true;
    this.emit(true);

    const done = () => {
      URL.revokeObjectURL(url);
      if (this.current === audio) {
        this.current = null;
        this.currentUrl = null;
      }
      this.playing = false;
      if (this.queue.length === 0) this.emit(false);
      this.tick();
    };
    audio.addEventListener("ended", done);
    audio.addEventListener("error", done);
    audio.play().catch(done);
  }

  stop(): void {
    this.queue = [];
    if (this.current) {
      this.current.pause();
      if (this.currentUrl) URL.revokeObjectURL(this.currentUrl);
      this.current = null;
      this.currentUrl = null;
    }
    this.playing = false;
    this.emit(false);
  }

  get isActive(): boolean {
    return this.playing || this.queue.length > 0;
  }

  private emit(s: boolean): void {
    this.onStateChange?.(s);
  }
}

/** Shared client state types.
 *
 * `Phase` is the voice-loop state machine the whole UI keys off of:
 *   idle      — connected, ambiently listening for the wake word
 *   listening — wake word heard; recording the user's command (VAD running)
 *   thinking  — utterance sent; Amber is transcribing / generating
 *   speaking  — playing Amber's streamed reply, sentence by sentence
 *
 * `ConnState` is the WebSocket transport status, orthogonal to `Phase`.
 */
export type Phase = "idle" | "listening" | "thinking" | "speaking";

export type ConnState = "disconnected" | "connecting" | "connected" | "error";

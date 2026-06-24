/** Client-declared tools — capabilities this client runs on its own device,
 * which Amber can invoke by voice.
 *
 * The client sends a `register_tools` frame; Amber offers them to the model and,
 * when the model calls one, sends a `tool_call` back which we run here and answer
 * with a `tool_result`. (See `app/client_tools.py` in the backend.) Names are
 * declared bare here and `client_`-prefixed server-side, so a `tool_call` for
 * `update` arrives as `client_update`.
 *
 * The headline tool is **update** — it pulls the latest code from GitHub on the
 * server hosting this client, rebuilds, restarts, and reloads the page once the
 * new build is live. So "Amber, update yourself" ships a new version hands-free.
 */
import type { ToolSpec } from "@/lib/connection";

export type ClientTool = ToolSpec & {
  run: (input: Record<string, unknown>) => Promise<string>;
};

export type VersionInfo = {
  commit: string;
  branch: string;
  subject: string;
};

/** Current deployed version, from the server (`git` on the host). */
export async function fetchVersion(): Promise<VersionInfo> {
  const res = await fetch("/api/version", { cache: "no-store" });
  if (!res.ok) throw new Error(`version check failed (${res.status})`);
  return (await res.json()) as VersionInfo;
}

/** How the self-update ended, for the caller to act on (clear the overlay, speak
 *  the outcome). `ok` is true only when a new build is live and we're reloading. */
export type UpdateOutcome = { ok: boolean; message: string };

export type UpdateHooks = {
  /** Called once when the update reaches a terminal state (success, failure, or
   *  timeout). On success the page reloads, so this fires mainly for the failure
   *  paths the UI needs to recover from. */
  onSettled?: (outcome: UpdateOutcome) => void;
};

const UPDATE_DEADLINE_MS = 6 * 60 * 1000; // give the build up to 6 minutes
const POLL_MS = 4000;

/** Kick off a self-update on the server and watch it to a terminal state in the
 *  background: reload once the rebuilt server is live, or report failure/timeout
 *  via `hooks.onSettled` so the UI never stays stuck on the update screen. Returns
 *  immediately with a human-readable status for Amber to speak. */
export async function triggerSelfUpdate(
  token: string,
  hooks: UpdateHooks = {},
): Promise<string> {
  const settle = (ok: boolean, message: string) => hooks.onSettled?.({ ok, message });

  let before = "";
  try {
    before = (await fetchVersion()).commit;
  } catch {
    /* version endpoint may be unavailable; we can still try to update */
  }

  let res: Response;
  try {
    res = await fetch("/api/update", {
      method: "POST",
      headers: token ? { "x-amber-update-token": token } : {},
    });
  } catch (e) {
    const msg = `Couldn't reach the update service: ${e instanceof Error ? e.message : String(e)}`;
    settle(false, msg); // never started — release the overlay now
    return msg;
  }

  if (res.status === 401) {
    const msg = "The update was rejected — the update token is missing or wrong (set it in Settings).";
    settle(false, msg);
    return msg;
  }
  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 200);
    const msg = `Update failed to start (HTTP ${res.status})${detail ? ": " + detail : ""}.`;
    settle(false, msg);
    return msg;
  }

  watchUpdate(before, hooks);
  return "Update started — pulling the latest from GitHub and rebuilding. I'll refresh the screen once the new version is live.";
}

/** Poll the update's progress to a terminal state. Two signals, checked together:
 *
 *  - `/api/update/status` reports `failed` (build/restart error, e.g. a bad
 *    branch) — stop and surface it, instead of waiting out the deadline.
 *  - `/api/version` responding with a *changed* commit means the rebuilt server is
 *    back up with new code → reload. This is the reliable "it's live" signal: the
 *    endpoint only answers once the new server is serving.
 *
 *  A `done` status with the *same* commit (a no-op "already latest" rebuild) still
 *  resolves once the server is reachable again, so that case clears too. If neither
 *  fires within the deadline we settle as a timeout rather than spin forever. */
function watchUpdate(before: string, hooks: UpdateHooks): void {
  if (typeof window === "undefined") return;
  const settle = (ok: boolean, message: string) => hooks.onSettled?.({ ok, message });
  const deadline = Date.now() + UPDATE_DEADLINE_MS;

  const poll = async () => {
    if (Date.now() > deadline) {
      settle(
        false,
        "The update is taking longer than expected. It may still finish — try reloading in a minute.",
      );
      return;
    }

    let status = "";
    try {
      const r = await fetch("/api/update/status", { cache: "no-store" });
      if (r.ok) status = String((await r.json()).state ?? "");
    } catch {
      /* status endpoint unavailable — fall back to the version check below */
    }

    if (status === "failed") {
      settle(
        false,
        "The update failed while rebuilding — the previous version is still running. Check the update log on the host.",
      );
      return;
    }

    // The rebuilt server coming back is the trustworthy success signal.
    try {
      const { commit } = await fetchVersion();
      if (commit) {
        const newCommit = before !== "" && commit !== before;
        if (newCommit || status === "done") {
          window.location.reload();
          return;
        }
      }
    } catch {
      /* server is mid-restart — keep polling */
    }

    window.setTimeout(poll, POLL_MS);
  };

  window.setTimeout(poll, 6000); // let the build get going before the first check
}

/** Turn the kiosk display on or off via the host (`/api/screen` runs the
 *  configured `xset` command). Returns a short status for Amber to speak. */
export async function setScreen(
  state: "on" | "off",
  token: string,
): Promise<string> {
  let res: Response;
  try {
    res = await fetch("/api/screen", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(token ? { "x-amber-update-token": token } : {}),
      },
      body: JSON.stringify({ state }),
    });
  } catch (e) {
    return `Couldn't reach the screen control: ${e instanceof Error ? e.message : String(e)}`;
  }

  if (res.status === 401) {
    return "Screen control was rejected — the token is missing or wrong (set it in Settings).";
  }
  if (res.status === 501) {
    return `Turning the screen ${state} isn't set up on this device.`;
  }
  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 200);
    return `Couldn't turn the screen ${state} (HTTP ${res.status})${detail ? ": " + detail : ""}.`;
  }
  return `Screen turned ${state}.`;
}

/** Build the client's tool set. `getUpdateToken` is read live so a token edited
 *  in Settings takes effect without re-registering. `hooks.onSettled` lets the UI
 *  recover the update screen when a self-update fails or times out (success reloads
 *  the page). */
export function buildClientTools(
  getUpdateToken: () => string,
  hooks: UpdateHooks = {},
): ClientTool[] {
  return [
    {
      name: "update",
      description:
        "Update this Amber web client to the latest version from GitHub: pull the " +
        "newest code on the host, rebuild, restart, and reload the screen. Use when " +
        "the user asks to update, upgrade, or pull the latest version of the client/app/screen.",
      input_schema: { type: "object", properties: {} },
      run: async () => triggerSelfUpdate(getUpdateToken(), hooks),
    },
    {
      name: "version",
      description:
        "Report the version this Amber web client is currently running (git commit, " +
        "branch, and latest commit message). Use when the user asks what version, " +
        "build, or commit the client/screen is on.",
      input_schema: { type: "object", properties: {} },
      run: async () => {
        try {
          const v = await fetchVersion();
          return `Running ${v.branch} @ ${v.commit} — "${v.subject}".`;
        } catch (e) {
          return `Couldn't read the version: ${e instanceof Error ? e.message : String(e)}.`;
        }
      },
    },
    {
      name: "set_screen",
      description:
        "Turn this device's display/screen/monitor on or off. Use when the user " +
        "asks to turn the screen off, turn it on, wake the display, or sleep the " +
        "screen. Pass state='off' or state='on'.",
      input_schema: {
        type: "object",
        properties: {
          state: {
            type: "string",
            enum: ["on", "off"],
            description: "Desired display state: 'on' or 'off'.",
          },
        },
        required: ["state"],
      },
      run: async (input) => {
        const state = input?.state === "on" ? "on" : input?.state === "off" ? "off" : null;
        if (!state) return "I need to know whether to turn the screen on or off.";
        return setScreen(state, getUpdateToken());
      },
    },
  ];
}

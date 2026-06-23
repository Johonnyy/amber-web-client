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

/** Kick off a self-update on the server and, in the background, reload the page
 *  once the rebuilt server reports a new commit. Returns immediately with a
 *  human-readable status for Amber to speak. */
export async function triggerSelfUpdate(token: string): Promise<string> {
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
    return `Couldn't reach the update service: ${e instanceof Error ? e.message : String(e)}`;
  }

  if (res.status === 401) {
    return "The update was rejected — the update token is missing or wrong (set it in Settings).";
  }
  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 200);
    return `Update failed to start (HTTP ${res.status})${detail ? ": " + detail : ""}.`;
  }

  watchAndReload(before);
  return "Update started — pulling the latest from GitHub and rebuilding. I'll refresh the screen once the new version is live.";
}

/** Poll the version endpoint until the commit changes (the rebuilt server is up),
 *  then reload so the running page picks up the new client code. */
function watchAndReload(before: string): void {
  if (typeof window === "undefined") return;
  const deadline = Date.now() + 6 * 60 * 1000; // give the build up to 6 minutes
  const poll = async () => {
    if (Date.now() > deadline) return;
    try {
      const { commit } = await fetchVersion();
      if (commit && commit !== before) {
        window.location.reload();
        return;
      }
    } catch {
      /* server is mid-restart — keep polling */
    }
    window.setTimeout(poll, 4000);
  };
  window.setTimeout(poll, 6000); // let the build get going before first check
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
 *  in Settings takes effect without re-registering. */
export function buildClientTools(getUpdateToken: () => string): ClientTool[] {
  return [
    {
      name: "update",
      description:
        "Update this Amber web client to the latest version from GitHub: pull the " +
        "newest code on the host, rebuild, restart, and reload the screen. Use when " +
        "the user asks to update, upgrade, or pull the latest version of the client/app/screen.",
      input_schema: { type: "object", properties: {} },
      run: async () => triggerSelfUpdate(getUpdateToken()),
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

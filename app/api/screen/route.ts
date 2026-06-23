import { execFile } from "node:child_process";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/screen — turn the kiosk display on or off on the host.
 *
 * The browser can't reach its own screen, but this Next.js server (running on the
 * kiosk Pi) can: it runs a preconfigured shell command per direction — typically
 * `xset dpms force off` / `xset dpms force on`. The request only selects a
 * *direction* ("on"/"off"); the command itself is fixed in env, so there's no
 * command injection from the request body.
 *
 * Body: { "state": "on" | "off" }
 *
 * Config (env):
 *   AMBER_SCREEN_OFF_CMD  shell command run to turn the screen OFF.
 *   AMBER_SCREEN_ON_CMD   shell command run to turn the screen ON.
 *                         A direction whose command is unset returns 501 (so the
 *                         client tool can tell the user it isn't wired up here).
 *   AMBER_UPDATE_TOKEN    the shared device-control token (same one /api/update
 *                         uses). When set, the request must send a matching
 *                         `x-amber-update-token` header. The browser sends it from
 *                         the "Update token" setting.
 *
 * These commands need an X server + the right DISPLAY/XAUTHORITY in the service
 * environment to take effect — set them on the kiosk unit (see deploy/README.md).
 */

const TIMEOUT_MS = 5000;

function run(cmd: string): Promise<{ ok: boolean; detail: string }> {
  return new Promise((resolve) => {
    // Run via the shell so a configured command like "xset dpms force off" with
    // args works as written. The string is operator-provided env, not user input.
    execFile(
      "/bin/sh",
      ["-c", cmd],
      { timeout: TIMEOUT_MS },
      (err, _stdout, stderr) => {
        if (err) {
          const detail =
            (stderr || "").trim() || err.message || `exit ${err.code ?? "?"}`;
          resolve({ ok: false, detail: detail.slice(0, 200) });
        } else {
          resolve({ ok: true, detail: "" });
        }
      },
    );
  });
}

export async function POST(request: Request) {
  const required = process.env.AMBER_UPDATE_TOKEN;
  if (required) {
    const got = request.headers.get("x-amber-update-token");
    if (got !== required) {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  let state: unknown;
  try {
    ({ state } = (await request.json()) as { state?: unknown });
  } catch {
    return Response.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (state !== "on" && state !== "off") {
    return Response.json(
      { error: "state must be 'on' or 'off'" },
      { status: 400 },
    );
  }

  const cmd =
    state === "off"
      ? process.env.AMBER_SCREEN_OFF_CMD
      : process.env.AMBER_SCREEN_ON_CMD;
  if (!cmd) {
    return Response.json(
      { error: `turning the screen ${state} is not configured on this host` },
      { status: 501 },
    );
  }

  const { ok, detail } = await run(cmd);
  if (!ok) {
    return Response.json({ error: detail }, { status: 500 });
  }
  return Response.json({ status: "ok", state });
}

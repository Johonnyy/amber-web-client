import { spawn } from "node:child_process";
import path from "node:path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/update — trigger a self-update of this web client.
 *
 * Launches the updater **detached** and returns immediately; the updater pulls
 * the latest code, rebuilds, and restarts the server on its own. The browser
 * (see `lib/clientTools.ts`) polls `/api/version` and reloads once the new build
 * is live.
 *
 * Config (env):
 *   AMBER_UPDATE_TOKEN   if set, the request must send a matching
 *                        `x-amber-update-token` header (the client reads it from
 *                        its `updateToken` setting). If unset, the route is open
 *                        — fine for localhost, set it in production.
 *   AMBER_UPDATE_CMD     a full shell command to run instead of the default
 *                        script. Recommended in production so the updater runs
 *                        OUTSIDE the service's cgroup and survives the restart,
 *                        e.g.
 *                          sudo systemd-run --collect --unit=amber-web-update \
 *                            bash /opt/amber-web/scripts/self-update.sh
 *   AMBER_UPDATE_SCRIPT  path to the updater script (default
 *                        `scripts/self-update.sh`) when AMBER_UPDATE_CMD is unset.
 */
export async function POST(request: Request) {
  const required = process.env.AMBER_UPDATE_TOKEN;
  if (required) {
    const got = request.headers.get("x-amber-update-token");
    if (got !== required) {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const cmd = process.env.AMBER_UPDATE_CMD;
  const script =
    process.env.AMBER_UPDATE_SCRIPT || path.join(process.cwd(), "scripts", "self-update.sh");

  try {
    const child = cmd
      ? spawn(cmd, { detached: true, stdio: "ignore", shell: true, cwd: process.cwd(), env: process.env })
      : spawn("bash", [script], {
          detached: true,
          stdio: "ignore",
          cwd: process.cwd(),
          env: process.env,
        });
    child.on("error", () => {
      /* surfaced to the client only as "failed to start" via the catch below if
         it throws synchronously; async spawn errors are logged by the OS */
    });
    child.unref();
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }

  return Response.json({ status: "started" });
}

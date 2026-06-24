import { readFile } from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const STATES = new Set(["building", "done", "failed"]);

/**
 * GET /api/update/status — progress of an in-flight (or the last) self-update.
 *
 * `state` is one of `building` | `done` | `failed`, written by
 * `scripts/self-update.sh` (and seeded to `building` by POST /api/update). It's
 * `idle` when no update has ever run. `log` is the tail of `.self-update.log` for
 * surfacing the failure reason. The browser (lib/clientTools.ts) polls this so the
 * update screen resolves on a real outcome instead of waiting forever.
 */
export async function GET() {
  const root = process.cwd();

  let state = "idle";
  try {
    const raw = (
      await readFile(path.join(root, ".self-update.status"), "utf8")
    ).trim();
    if (STATES.has(raw)) state = raw;
  } catch {
    /* no status file yet — nothing has run, leave as idle */
  }

  let log = "";
  try {
    log = (await readFile(path.join(root, ".self-update.log"), "utf8")).slice(-2000);
  } catch {
    /* no log yet */
  }

  return Response.json({ state, log });
}

import { execFile } from "node:child_process";
import { promisify } from "node:util";

// Reads live git state on every request — never cached.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const exec = promisify(execFile);

async function git(args: string[]): Promise<string> {
  try {
    const { stdout } = await exec("git", args, { cwd: process.cwd() });
    return stdout.trim();
  } catch {
    return "";
  }
}

/** GET /api/version — the version this client is currently running. */
export async function GET() {
  const [commit, branch, subject] = await Promise.all([
    git(["rev-parse", "--short", "HEAD"]),
    git(["rev-parse", "--abbrev-ref", "HEAD"]),
    git(["log", "-1", "--pretty=%s"]),
  ]);
  return Response.json({ commit, branch, subject });
}

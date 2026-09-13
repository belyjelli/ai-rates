// Stamps apps/worker/src/build-info.ts with the commit a Workers Builds deploy is built from, so the
// About page can name the version that is live. Runs as wrangler's custom build command
// (wrangler.jsonc), which `wrangler deploy` executes before bundling.
//
// Outside Workers Builds it does nothing: the committed placeholder stays, so tests and a local
// `wrangler dev` never leave the tree dirty. And it never fails the build. A version the page
// cannot name is better than a site that did not ship.
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

if (process.env.WORKERS_CI !== "1") process.exit(0);

const git = (...args) => {
  try {
    return execFileSync("git", args, { encoding: "utf8" }).trim() || null;
  } catch {
    return null;
  }
};

try {
  const build = {
    commit: process.env.WORKERS_CI_COMMIT_SHA || git("rev-parse", "HEAD"),
    subject: git("log", "-1", "--format=%s"),
    committedAt: git("log", "-1", "--format=%cI"),
    builtAt: new Date().toISOString(),
  };
  const source = `// Stamped by apps/worker/scripts/stamp-build.mjs during a Workers Builds deploy.
export interface BuildInfo {
  commit: string | null;
  subject: string | null;
  committedAt: string | null;
  builtAt: string | null;
}

export const BUILD: BuildInfo = ${JSON.stringify(build, null, 2)};
`;
  writeFileSync(new URL("../src/build-info.ts", import.meta.url), source);
  // No `??` or `?.` anywhere in this file: an older Node would fail to parse it, and a script that
  // cannot parse fails the build before any try/catch runs.
  console.log(`stamp-build: ${build.commit || "unknown commit"}`);
} catch (error) {
  console.warn(`stamp-build: left the placeholder in place (${error})`);
}

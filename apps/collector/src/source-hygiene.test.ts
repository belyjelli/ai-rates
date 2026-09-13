import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * No tracked TypeScript source may contain a raw U+0000 byte.
 *
 * This is not style. Such a byte makes `file` report the source as `data`, and grep then treats it
 * as binary and prints NOTHING -- not "binary file matches", just silence. Git renders every diff
 * of that file as `Bin N -> M bytes`, so review sees byte counts where code should be.
 *
 * It has now cost two sessions. The first (91aca39) was an accident: the byte sat where a space
 * belonged in a Map dedupe key, and three greps returned empty before anyone stopped trusting them.
 * Typecheck, lint, the whole suite and the running collector all passed throughout, because it
 * separates exactly as well as a space does.
 *
 * The second was deliberate and therefore worse. It came back as a composite-key separator -- a
 * delimiter that cannot occur inside a venue id or a venue symbol -- and spread to 17 occurrences
 * across two methods of store.ts. Greps for `refreshRankedPairs` then returned nothing, and the
 * method was reported missing, lost, and never committed when it was present and passing its own
 * integration test the entire time. Four rounds of investigation went into a file the tools had
 * quietly refused to read.
 *
 * The separator itself is sound and the fix is NOT to abandon it. Write it as the six-character
 * escape sequence instead (backslash, u, four zeroes): the identical one-code-unit string at
 * runtime, byte-for-byte the same keys, and the file stays searchable. This test pins that
 * distinction -- the escape is allowed, the raw byte is not.
 *
 * Scope is what git tracks, not what sits on disk. A filesystem walk also sweeps up the sibling
 * agent worktrees under .claude/, which are separate checkouts at older commits and would fail this
 * on code that is not ours to fix. Tracked files are the ones a commit can actually carry.
 */
const REPO_ROOT = join(import.meta.dir, "..", "..", "..");

function trackedTypeScript(): string[] {
  const listed = Bun.spawnSync(["git", "ls-files", "-z", "*.ts"], { cwd: REPO_ROOT });
  if (listed.exitCode !== 0) throw new Error(`git ls-files failed: ${listed.stderr.toString()}`);
  return listed.stdout.toString().split("\0").filter(Boolean);
}

describe("source hygiene", () => {
  test("no tracked .ts holds a raw U+0000, which makes grep and git diff blind to it", () => {
    const sources = trackedTypeScript();
    // A guard that silently scans nothing is worse than no guard: it reports success forever.
    expect(sources.length).toBeGreaterThan(50);

    const offenders = sources
      .map((path) => {
        // latin1 keeps one JS char per byte, so the scan cannot be fooled by multi-byte decoding.
        const text = readFileSync(join(REPO_ROOT, path), "latin1");
        let count = 0;
        for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 0) count++;
        return { path, count };
      })
      .filter((file) => file.count > 0);

    expect(offenders).toEqual([]);
  });
});

/**
 * Which commit is running, for the About page.
 *
 * This committed copy is a placeholder: it is what tests, `wrangler dev` and any deploy outside
 * Workers Builds see, and it says nothing was recorded rather than naming a commit it cannot know.
 * During a Workers Builds deploy, `apps/worker/scripts/stamp-build.mjs` overwrites it with the
 * commit the build was made from. A commit cannot contain its own hash, so this is the only way
 * the page can name the version that is actually live.
 */
export interface BuildInfo {
  /** Full commit SHA the deployed code was built from. */
  commit: string | null;
  /** That commit's subject line. */
  subject: string | null;
  /** When the commit was made, ISO 8601. */
  committedAt: string | null;
  /** When the build ran, ISO 8601. */
  builtAt: string | null;
}

export const BUILD: BuildInfo = {
  commit: null,
  subject: null,
  committedAt: null,
  builtAt: null,
};

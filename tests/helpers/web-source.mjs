// Shared loader for the Spaartrack web frontend source.
//
// ISSUE-12 split `apps/web/index.html` (674 lines, 502 inline script lines) into
// `apps/web/index.html` (markup + styles) plus `apps/web/js/*.js` (behaviour).
//
// Contract tests assert on *the web frontend source*, not on one file. Before the
// split "the web source" was a single string; after the split it is the markup
// plus every extracted script. This helper restores that single-string view so
// marker assertions keep their original meaning and strength.
//
// Rule: a helper must never soften an assertion. `webSource()` returns the
// concatenation of markup + scripts, so a marker assertion against it is exactly
// as strict as before the split — a marker that moved into a .js file is still
// found, and a marker that never existed is still absent.
import { readFileSync, readdirSync } from "node:fs";

const root = new URL("../../", import.meta.url);
const webDir = new URL("apps/web/", root);
const jsDir = new URL("apps/web/js/", root);

let cachedHtml = null;
let cachedJs = null;

/** Raw `apps/web/index.html` markup (no inline behaviour since ISSUE-12). */
export function webHtml() {
  if (cachedHtml === null) cachedHtml = readFileSync(new URL("index.html", webDir), "utf8");
  return cachedHtml;
}

/** Concatenated contents of every extracted script in `apps/web/js/`. */
export function webScripts() {
  if (cachedJs === null) {
    cachedJs = readdirSync(jsDir)
      .filter((name) => name.endsWith(".js"))
      .sort()
      .map((name) => `\n/* ${name} */\n${readFileSync(new URL(name, jsDir), "utf8")}`)
      .join("\n");
  }
  return cachedJs;
}

/**
 * The full web frontend source: markup plus every extracted script.
 * Use this for marker assertions that may live in either place.
 */
export function webSource() {
  return `${webHtml()}\n${webScripts()}`;
}

/** Alias of {@link webSource}, for call sites that read it as a loader. */
export const readWebSource = webSource;

/** Absolute URL of the repository root, for tests that need sibling paths. */
export const repoRoot = root;

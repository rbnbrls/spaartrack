import { webUrl } from "../support/local-endpoints.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";

const root = new URL("../..", import.meta.url);
const webDir = new URL("apps/web/", root);
const jsDir = new URL("apps/web/js/", root);

const html = readFileSync(new URL("index.html", webDir), "utf8");
const jsFiles = readdirSync(jsDir).filter((name) => name.endsWith(".js")).sort();
const scriptSource = jsFiles.map((name) => readFileSync(new URL(name, jsDir), "utf8")).join("\n");

// ---------------------------------------------------------------- ISSUE-12 ---

test("TC-US-0501-web: web frontend has no inline script and keeps behaviour in external files", () => {
  // The markup must not carry executable inline script any more.
  const inlineBodies = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)]
    .map((match) => match[1].trim())
    .filter((body) => body.length > 0);
  assert.deepEqual(inlineBodies, [], "index.html must not contain inline executable script");

  // Every script the page loads must point at a file that exists.
  const sources = [...html.matchAll(/<script[^>]*\bsrc="([^"]+)"/gi)].map((match) => match[1]);
  assert.ok(sources.length >= 5, `expected external scripts, found ${sources.length}`);
  for (const src of sources) {
    if (src.startsWith("/js/")) {
      const name = src.slice("/js/".length);
      assert.ok(jsFiles.includes(name), `${src} must exist in apps/web/js/`);
    }
  }

  // The behaviour must not have been deleted along the way: the extracted
  // scripts carry the real implementation, not a stub.
  assert.ok(jsFiles.length >= 4, `expected extracted scripts, found ${jsFiles.length}`);
  const totalBytes = jsFiles.reduce((sum, name) => sum + statSync(new URL(name, jsDir)).size, 0);
  assert.ok(totalBytes > 150_000, `extracted behaviour must be substantial, got ${totalBytes} bytes`);
});

test("TC-US-0501-web: every extracted script is valid JavaScript", () => {
  for (const name of jsFiles) {
    const source = readFileSync(new URL(name, jsDir), "utf8");
    // A classic script is parsed as a Script, not a Module: no import/export.
    assert.doesNotMatch(source, /^\s*(import|export)\s/m, `${name} must stay a classic script`);
    assert.doesNotMatch(source, /\bawait\s+[^;]*\n[^;]*$/m, `${name} must not use top-level await`);
    // Compiling catches syntax errors without executing anything.
    assert.doesNotThrow(() => new Function(source), `${name} must parse`);
  }
});

test("TC-US-0501-web: extracted scripts keep the shared api/auth/toast contract reachable", () => {
  // These are cross-block globals; after extraction they must still be defined
  // by exactly one script, otherwise the page silently loses its api client.
  for (const symbol of ["apiCall", "authHeaders", "authHeadersFor", "showToast"]) {
    const defining = jsFiles.filter((name) =>
      new RegExp(`(?:const|let|var|function)\\s+${symbol}\\b|,${symbol}\\s*=`).test(
        readFileSync(new URL(name, jsDir), "utf8")
      )
    );
    assert.equal(defining.length, 1, `${symbol} must be defined in exactly one script, found ${defining.length}`);
  }
  assert.match(scriptSource, /x-trace-id/);
  assert.match(scriptSource, /x-correlation-id/);
});

// The regression this branch fixes: four "Prepare synthetic fixture" buttons
// had their click listener attached before the button existed in the DOM, so
// `getElementById` returned null, the optional-chaining operator swallowed the
// miss, and the button was permanently dead. The markup for these panels is
// emitted after the script that used to bind them.
const LATE_BOUND_CONTROLS = [
  "prepare-alternative-assets",
  "prepare-portfolio-share-links",
  "prepare-restricted-view",
  "prepare-wheel-strategy",
];

test("TC-US-0501-web: every synthetic fixture button is bound after its markup exists", () => {
  for (const id of LATE_BOUND_CONTROLS) {
    assert.match(html, new RegExp(`id="${id}"`), `${id} must exist in the markup`);

    // The binding must live in a script, and that script must be loaded after
    // the markup that contains the button.
    const binding = jsFiles.find((name) =>
      new RegExp(`getElementById\\('${id}'\\)`).test(readFileSync(new URL(name, jsDir), "utf8"))
    );
    assert.ok(binding, `${id} must be bound in an extracted script`);

    const scriptTag = new RegExp(`<script[^>]*src="/js/${binding}"[^>]*>`).exec(html);
    assert.ok(scriptTag, `${binding} must be referenced by index.html`);

    const markupIndex = html.indexOf(`id="${id}"`);
    const scriptIndex = scriptTag.index;
    assert.ok(
      markupIndex < scriptIndex,
      `${id} is bound by ${binding} which loads before the markup (${markupIndex} > ${scriptIndex})`
    );
  }
});

// Prepare controls that are intentionally not wired in the GUI. This is a
// pre-existing gap on `main` (the addon-sandbox panel ships markup for a
// fixture button while the wired control is `prepare-addon-sdk`), it is NOT
// introduced by this extraction. The list is explicit so that any *new*
// unwired prepare button fails this gate.
const KNOWN_UNWIRED_PREPARE_CONTROLS = new Set(["prepare-addon-sandbox"]);

test("TC-US-0501-web: the dead-fixture regression is pinned for every prepare control", () => {
  // Guards the general shape of the bug: a prepare button whose binding is
  // loaded before the markup it targets can never fire.
  const prepareButtons = [...html.matchAll(/id="(prepare-[a-z0-9-]+)"/g)].map((match) => match[1]);
  assert.ok(prepareButtons.length >= 10, `expected the prepare controls to stay in the markup, found ${prepareButtons.length}`);

  for (const id of prepareButtons) {
    const binding = jsFiles.find((name) =>
      new RegExp(`getElementById\\('${id}'\\)`).test(readFileSync(new URL(name, jsDir), "utf8"))
    );
    if (!binding) {
      assert.ok(
        KNOWN_UNWIRED_PREPARE_CONTROLS.has(id),
        `${id} is not wired at all; add it to KNOWN_UNWIRED_PREPARE_CONTROLS only with a reason`
      );
      continue;
    }
    const scriptTag = new RegExp(`<script[^>]*src="/js/${binding}"[^>]*>`).exec(html);
    assert.ok(scriptTag, `${binding} must be referenced by index.html`);
    const markupIndex = html.indexOf(`id="${id}"`);
    assert.ok(
      markupIndex < scriptTag.index,
      `${id} is bound by ${binding} before its markup exists (${markupIndex} > ${scriptTag.index})`
    );
  }
});

test("TC-US-0501-web: the web image ships the extracted scripts", () => {
  const dockerfile = readFileSync(new URL("apps/web/Dockerfile", root), "utf8");
  assert.match(dockerfile, /COPY apps\/web\/js \/usr\/share\/nginx\/html\/js/);
  const nginx = readFileSync(new URL("apps/web/nginx.conf", root), "utf8");
  assert.match(nginx, /location \/api\//);
  // The SPA fallback must not swallow a missing script into HTML.
  assert.match(nginx, /try_files \$uri \/index\.html/);
});

test("TC-US-0501-web runtime: the built web image serves the extracted scripts", { skip: !process.env.STACK_SMOKE }, async () => {
  const base = (webUrl).replace(/\/$/, "");
  const page = await fetch(`${base}/`);
  assert.equal(page.status, 200);
  const body = await page.text();
  assert.doesNotMatch(body, /<script(?![^>]*\bsrc=)[^>]*>\s*\S/, "served page must not contain inline script");
  for (const name of jsFiles) {
    const res = await fetch(`${base}/js/${name}`);
    assert.equal(res.status, 200, `${name} must be served`);
    assert.match(res.headers.get("content-type") || "", /javascript/, `${name} must be served as JavaScript`);
  }
});

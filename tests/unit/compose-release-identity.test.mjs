import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const compose = readFileSync(new URL("../../compose.yaml", import.meta.url), "utf8");
const wrapper = readFileSync(new URL("../../scripts/dev/compose.sh", import.meta.url), "utf8");
const releaseReadme = readFileSync(new URL("../../infra/release/README.md", import.meta.url), "utf8");

test("local compose binds git identity without inventing an image digest", () => {
  assert.match(compose, /scripts\/dev\/compose\.sh/);
  assert.match(wrapper, /git rev-parse --verify HEAD/);
  assert.match(wrapper, /APP_COMMIT_SHA/);
  assert.match(wrapper, /APP_IMAGE_DIGEST/);
  assert.match(wrapper, /local/);
  assert.match(releaseReadme, /APP_COMMIT_SHA/);
  assert.match(releaseReadme, /APP_IMAGE_DIGEST/);
  assert.match(releaseReadme, /unbound/i);
});

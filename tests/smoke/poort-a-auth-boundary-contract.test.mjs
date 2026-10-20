import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../..", import.meta.url);
const apiSource = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");
const composeSource = readFileSync(new URL("compose.yaml", root), "utf8");
const envExample = readFileSync(new URL(".env.example", root), "utf8");

test("Poort A auth boundary denies email-only public sessions and gates fixture sessions locally", () => {
  assert.match(apiSource, /req\.method === "POST" && req\.url === "\/api\/v1\/sessions"/);
  assert.match(apiSource, /AUTHENTICATOR_NOT_CONFIGURED/);
  assert.match(apiSource, /req\.url === "\/api\/v1\/test-fixtures\/sessions"/);
  assert.match(apiSource, /SYNTHETIC_FIXTURE_KEY/);
  assert.match(apiSource, /environment !== "local" \|\| authMode !== "synthetic"/);
  assert.match(composeSource, /APP_AUTH_MODE: \$\{APP_AUTH_MODE:-synthetic\}/);
  assert.match(composeSource, /SYNTHETIC_FIXTURE_KEY/);
  assert.match(envExample, /APP_AUTH_MODE=synthetic/);
  assert.match(envExample, /SYNTHETIC_FIXTURE_KEY=/);
});

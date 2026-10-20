import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const root = new URL("../..", import.meta.url);
const apiSource = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");
const composeSource = readFileSync(new URL("compose.yaml", root), "utf8");
const envExample = readFileSync(new URL(".env.example", root), "utf8");

const FIXTURE_KEY = "local-test-fixture-only";

// Test files that MUST keep calling the public login route: each one asserts
// that an email-only public login is REFUSED. Migrating those to the fixture
// route would delete the denial assertion, so they are allow-listed by
// contract, not by convenience.
const PUBLIC_ROUTE_ALLOWLIST = new Map([
  ["session-contract.test.mjs", ["emailOnly", "emailOnlyExistingUser"]],
  ["identity-auth-boundary-contract.test.mjs", ["emailOnly", "login", "replayLogin"]],
  ["totp-contract.test.mjs", ["replayLogin"]],
  ["privacy-contract.test.mjs", ["loginAfterDelete"]],
]);

const smokeDirectory = new URL("tests/smoke/", root);
const smokeFiles = readdirSync(smokeDirectory).filter((name) => name.endsWith(".test.mjs"));

function publicLoginCallSites(source) {
  const sites = [];
  source.split("\n").forEach((line, index) => {
    if (!line.includes("/api/v1/sessions")) return;
    if (line.includes("sessions/me") || line.includes("sessions/current")) return;
    if (line.includes("test-fixtures/sessions")) return;
    // A bare marker inside a string array is a web-surface assertion, not a call.
    if (!line.includes("fetch(") && !line.includes("create(") && !line.includes("api(")) return;
    sites.push({ line: index + 1, text: line.trim() });
  });
  return sites;
}

test("TC-US-0201-BOOTSTRAP: no runtime test bootstraps a session from the public email-only login route", () => {
  const offenders = [];
  for (const name of smokeFiles) {
    const source = readFileSync(new URL(name, smokeDirectory), "utf8");
    const allowlisted = PUBLIC_ROUTE_ALLOWLIST.get(name);
    for (const site of publicLoginCallSites(source)) {
      if (allowlisted) {
        assert.ok(
          allowlisted.some((variable) => site.text.includes(variable)),
          `${name}:${site.line} calls the public login route but is not an allow-listed denial assertion: ${site.text}`
        );
        continue;
      }
      offenders.push(`${name}:${site.line}  ${site.text}`);
    }
  }
  assert.deepEqual(offenders, [], `public email-only login is refused by the API (AUTHENTICATOR_NOT_CONFIGURED), so these runtime tests can never obtain a session:\n${offenders.join("\n")}`);
});

test("TC-US-0201-BOOTSTRAP: every fixture-session call site carries the synthetic fixture key", () => {
  const missing = [];
  for (const name of smokeFiles) {
    if (name === "auth-session-bootstrap-contract.test.mjs") continue; // this file names the route in its own source
    const source = readFileSync(new URL(name, smokeDirectory), "utf8");
    const lines = source.split("\n");
    lines.forEach((line, index) => {
      if (!line.includes("/api/v1/test-fixtures/sessions")) return;
      // A call that deliberately OMITS the key asserts the denial; it must stay
      // key-less or the assertion it makes stops meaning anything.
      const expression = lines.slice(index, index + 4).join("\n");
      if (expression.includes(FIXTURE_KEY)) return;
      if (/unauthenticatedFixtureSession|noKey|withoutKey|missingKey/i.test(expression)) return;
      missing.push(`${name}:${index + 1}  ${line.trim()}`);
    });
  }
  assert.deepEqual(missing, [], `fixture sessions without the x-synthetic-fixture-key header are refused with SYNTHETIC_FIXTURE_AUTH_REQUIRED:\n${missing.join("\n")}`);
});

test("TC-US-0201-BOOTSTRAP: the local stack ships a fixture key that matches the key the tests send", () => {
  assert.match(composeSource, /SYNTHETIC_FIXTURE_KEY: \$\{SYNTHETIC_FIXTURE_KEY:-local-test-fixture-only\}/);
  assert.match(envExample, new RegExp(`^SYNTHETIC_FIXTURE_KEY=${FIXTURE_KEY}$`, "m"));
});

test("TC-US-0201-BOOTSTRAP: the public login route refuses email-only sessions and the fixture route stays local-only", () => {
  assert.match(apiSource, /AUTHENTICATOR_NOT_CONFIGURED/);
  assert.match(apiSource, /SYNTHETIC_FIXTURE_AUTH_REQUIRED/);
  assert.match(apiSource, /environment !== "local" \|\| authMode !== "synthetic"/);
  assert.match(apiSource, /x-synthetic-fixture-key/);
});

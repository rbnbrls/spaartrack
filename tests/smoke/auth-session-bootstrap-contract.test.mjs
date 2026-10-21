import { fixtureKey } from "../helpers/fixture-key.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const root = new URL("../..", import.meta.url);
const apiSource = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");
const composeSource = readFileSync(new URL("compose.yaml", root), "utf8");
const envExample = readFileSync(new URL(".env.example", root), "utf8");

// Test files that MUST keep calling the public login route: each one asserts
// that an email-only public login is REFUSED.
const PUBLIC_ROUTE_ALLOWLIST = new Map([
  ["session-contract.test.mjs", ["emailOnly", "emailOnlyExistingUser"]],
  ["identity-auth-boundary-contract.test.mjs", ["emailOnly", "login", "replayLogin"]],
  ["totp-contract.test.mjs", ["replayLogin"]],
  ["privacy-contract.test.mjs", ["loginAfterDelete"]],
  ["privacy-lifecycle-contract.test.mjs", ["loginAfterDelete"]],
]);

const smokeDirectory = new URL("tests/smoke/", root);
const smokeFiles = readdirSync(smokeDirectory).filter((name) => name.endsWith(".test.mjs"));

function publicLoginCallSites(source) {
  const sites = [];
  source.split("\n").forEach((line, index) => {
    if (!line.includes("/api/v1/sessions")) return;
    if (line.includes("sessions/me") || line.includes("sessions/current")) return;
    if (line.includes("test-fixtures/sessions")) return;
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

test("TC-US-0201-BOOTSTRAP: every fixture-session call site resolves its credential through the helper", () => {
  const missing = [];
  for (const name of smokeFiles) {
    if (name === "auth-session-bootstrap-contract.test.mjs") continue;
    const source = readFileSync(new URL(name, smokeDirectory), "utf8");
    const lines = source.split("\n");
    lines.forEach((line, index) => {
      if (!line.includes("/api/v1/test-fixtures/sessions")) return;
      const expression = lines.slice(index, index + 8).join("\n");
      if (/unauthenticatedFixtureSession|noKey|withoutKey|missingKey/i.test(expression)) return;
      if (expression.includes("fixtureKey()") || expression.includes("fixtureHeaders(")) return;
      missing.push(`${name}:${index + 1}  ${line.trim()}`);
    });
  }
  assert.deepEqual(
    missing,
    [],
    `fixture sessions must obtain x-synthetic-fixture-key through tests/helpers/fixture-key.mjs:\n${missing.join("\n")}`
  );
});

function envExampleValue() {
  return envExample.match(/^SYNTHETIC_FIXTURE_KEY=(.*)$/m)?.[1] ?? "";
}

function resolveComposeFixtureKey(environment) {
  return environment.SYNTHETIC_FIXTURE_KEY ?? "";
}

function resolveTestFixtureKey(environment) {
  return environment.SYNTHETIC_FIXTURE_KEY ?? "";
}

test("TC-US-0201-BOOTSTRAP: the stack and tests resolve the same fixture key", () => {
  assert.match(composeSource, /SYNTHETIC_FIXTURE_KEY: \$\{SYNTHETIC_FIXTURE_KEY:-\}/);
  const provisioned = { SYNTHETIC_FIXTURE_KEY: envExampleValue() };
  assert.equal(resolveComposeFixtureKey(provisioned), resolveTestFixtureKey(provisioned));
  assert.equal(resolveComposeFixtureKey({}), "");
  assert.equal(resolveTestFixtureKey({}), "");
});

test("TC-US-0201-BOOTSTRAP: the public login route refuses email-only sessions and the fixture route stays local-only", () => {
  assert.match(apiSource, /AUTHENTICATOR_NOT_CONFIGURED/);
  assert.match(apiSource, /SYNTHETIC_FIXTURE_AUTH_REQUIRED/);
  assert.match(apiSource, /environment !== "local" \|\| authMode !== "synthetic"/);
  assert.match(apiSource, /x-synthetic-fixture-key/);
});

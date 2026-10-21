import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Durable guard for the ruling on t_06c724c0 (US-0201 / TC-US-0201-BOOTSTRAP).
//
// The compose default for SYNTHETIC_FIXTURE_KEY must resolve to EMPTY when the
// variable is not provisioned. This test asserts the RESOLVED value, not the
// source text: `docker compose config` resolves the interpolation, and the
// assertion below re-implements that resolution so the guard also holds on a
// host without a Docker daemon.
//
// Threat model: `apps/api/src/index.ts` gates the fixture-session route on
// `environment === "local" && authMode === "synthetic"` plus a timing-safe
// comparison against SYNTHETIC_FIXTURE_KEY. compose.yaml also defaults
// APP_ENV to `local` and APP_AUTH_MODE to `synthetic`. A committed FALLBACK
// key therefore composes those three defaults into a live route that mints a
// session for any email using a value published in this repository. The
// fallback must stay empty; the local key belongs in .env.example only.

const root = new URL("../..", import.meta.url);
const composePath = new URL("compose.yaml", root);
const composeSource = readFileSync(composePath, "utf8");
const envExample = readFileSync(new URL(".env.example", root), "utf8");

const FIXTURE_KEY_VARIABLE = "SYNTHETIC_FIXTURE_KEY";

// The key the local test suite sends. It must never become a compose default.
const PUBLISHED_TEST_KEY = "local-test-fixture-only";

function apiEnvironmentEntry(source, variable) {
  const lines = source.split("\n");
  const apiStart = lines.findIndex((line) => /^ {2}api:\s*$/.test(line));
  assert.notEqual(apiStart, -1, "compose.yaml must declare an api service");
  const environmentStart = lines.findIndex(
    (line, index) => index > apiStart && /^ {4}environment:\s*$/.test(line)
  );
  assert.notEqual(environmentStart, -1, "the api service must declare an environment block");
  for (let index = environmentStart + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^ {0,4}\S/.test(line)) break; // next top-level or service key
    const match = line.match(/^ {6}([A-Z0-9_]+):\s*(.+?)\s*$/);
    if (match && match[1] === variable) return match[2];
  }
  return undefined;
}

// Resolve the `${VAR:-default}` / `${VAR-default}` interpolation that compose
// applies to an environment value. Unsupported syntax fails loudly so this
// guard cannot silently pass after someone changes the compose syntax.
function resolveComposeValue(expression, provided) {
  const match = expression.match(/^\$\{([A-Z0-9_]+)(:-?)(.*)\}$/);
  assert.ok(match, `unsupported compose interpolation for ${FIXTURE_KEY_VARIABLE}: ${expression}`);
  const [, variable, operator, fallback] = match;
  assert.equal(variable, FIXTURE_KEY_VARIABLE, `unexpected variable in ${expression}`);
  const isSet = provided !== undefined && provided !== "";
  if (operator === ":-") return isSet ? provided : fallback;
  return provided !== undefined ? provided : fallback;
}

test("TC-US-0201-BOOTSTRAP: the resolved compose fixture-key default is empty when the key is not provisioned", () => {
  const expression = apiEnvironmentEntry(composeSource, FIXTURE_KEY_VARIABLE);
  assert.ok(expression, `compose.yaml must set ${FIXTURE_KEY_VARIABLE} on the api service`);

  const resolvedWhenUnprovisioned = resolveComposeValue(expression, undefined);
  assert.equal(
    resolvedWhenUnprovisioned,
    "",
    `compose.yaml must resolve ${FIXTURE_KEY_VARIABLE} to an empty value when it is not provisioned, but it resolved to ${JSON.stringify(resolvedWhenUnprovisioned)}`
  );
  assert.notEqual(
    resolvedWhenUnprovisioned,
    PUBLISHED_TEST_KEY,
    `compose.yaml must not ship a usable fixture key as its default`
  );
});

test("TC-US-0201-BOOTSTRAP: a provisioned fixture key is passed through to the api service unchanged", () => {
  const expression = apiEnvironmentEntry(composeSource, FIXTURE_KEY_VARIABLE);
  assert.ok(expression, `compose.yaml must set ${FIXTURE_KEY_VARIABLE} on the api service`);
  const resolvedWhenProvisioned = resolveComposeValue(expression, "provisioned-key-value");
  assert.equal(
    resolvedWhenProvisioned,
    "provisioned-key-value",
    "an explicitly provisioned fixture key must reach the api service unchanged"
  );
});

test("TC-US-0201-BOOTSTRAP: the fixture route refuses an unset key and the public login route stays closed", () => {
  const apiSource = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");
  // An empty expected key must short-circuit the comparison before
  // timingSafeEqual, otherwise an empty header would satisfy an empty key.
  assert.match(apiSource, /!expectedFixtureKey \|\|/);
  assert.match(apiSource, /timingSafeEqual\(suppliedKeyBytes, expectedKeyBytes\)/);
  assert.match(apiSource, /SYNTHETIC_FIXTURE_AUTH_REQUIRED/);
  assert.match(apiSource, /environment !== "local" \|\| authMode !== "synthetic"/);
  assert.match(apiSource, /AUTHENTICATOR_NOT_CONFIGURED/);
});

test("TC-US-0201-BOOTSTRAP: .env.example carries the local key, and the compose default carries none", () => {
  assert.match(envExample, new RegExp(`^${FIXTURE_KEY_VARIABLE}=${PUBLISHED_TEST_KEY}$`, "m"));
  const expression = apiEnvironmentEntry(composeSource, FIXTURE_KEY_VARIABLE);
  assert.ok(expression, `compose.yaml must set ${FIXTURE_KEY_VARIABLE} on the api service`);
  assert.ok(
    !expression.includes(PUBLISHED_TEST_KEY),
    `compose.yaml must not embed the published test key in its default: ${expression}`
  );
});

test("TC-US-0201-BOOTSTRAP: docker compose resolves the fixture key to an empty value with no .env present", { skip: !dockerComposeAvailable() }, () => {
  // Resolve with the real compose binary in a scratch directory that holds
  // compose.yaml but no .env, i.e. exactly a deployment that forgot to
  // provision the key.
  const directory = mkdtempSync(join(tmpdir(), "spaartrack-fixture-key-"));
  copyFileSync(composePath.pathname, join(directory, "compose.yaml"));
  const config = execFileSync("docker", ["compose", "config", "--format", "json"], {
    cwd: directory,
    encoding: "utf8",
    env: { ...process.env, SYNTHETIC_FIXTURE_KEY: undefined }
  });
  const parsed = JSON.parse(config);
  const resolved = parsed.services.api.environment[FIXTURE_KEY_VARIABLE];
  assert.equal(
    resolved,
    "",
    `docker compose must resolve ${FIXTURE_KEY_VARIABLE} to an empty value without a .env, but it resolved to ${JSON.stringify(resolved)}`
  );
});

function dockerComposeAvailable() {
  const result = spawnSync("docker", ["compose", "version"], { encoding: "utf8" });
  return result.status === 0;
}

import assert from "node:assert/strict";
import { test } from "node:test";
import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const compose = readFileSync(resolve(root, "compose.yaml"), "utf8");
const wrapper = resolve(root, "scripts/dev/compose.sh");

test("Compose does not hard-code a shared project and exposes worktree ports", () => {
  assert.ok(existsSync(wrapper), "local Compose wrapper must exist");
  assert.doesNotMatch(compose, /^name:\s*spaartrack\s*$/m);
  for (const variable of [
    "WEB_PORT",
    "API_PORT",
    "DB_PORT",

    "OBJECT_STORAGE_PORT",
    "OBJECT_STORAGE_CONSOLE_PORT",
    "OTEL_GRPC_PORT",
    "OTEL_HTTP_PORT",
    "OTEL_METRICS_PORT",
    "PROMETHEUS_PORT",
    "GRAFANA_PORT",
  ]) {
    assert.match(compose, new RegExp(`\\$\\{${variable}:-`), `${variable} must be configurable`);
  }
});

function settings(worktreeRoot, extraEnv = {}) {
  const output = execFileSync(wrapper, ["settings"], {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env,
      COMPOSE_WRAPPER_TEST_ONLY: "1",
      COMPOSE_WORKTREE_ROOT: worktreeRoot,
      ...extraEnv,
    },
  });
  return Object.fromEntries(
    output.trim().split("\n").map((line) => line.split("=", 2)),
  );
}

test("Compose wrapper derives collision-resistant names and ports from checkout paths", () => {
  const primary = settings("/tmp/spaartrack");
  assert.deepEqual(
    Object.fromEntries(
      ["COMPOSE_PROJECT_NAME", "API_PORT", "DB_PORT", "WEB_PORT", "OBJECT_STORAGE_PORT"]
        .map((key) => [key, primary[key]]),
    ),
    {
      COMPOSE_PROJECT_NAME: "spaartrack",
      API_PORT: "18080",
      DB_PORT: "55432",
      WEB_PORT: "3000",
      OBJECT_STORAGE_PORT: "19000",
    },
  );

  const first = settings("/tmp/a/worktree");
  const second = settings("/tmp/b/worktree");
  assert.notEqual(first.COMPOSE_PROJECT_NAME, second.COMPOSE_PROJECT_NAME);
  assert.notEqual(first.API_PORT, second.API_PORT);
  assert.notEqual(first.DB_PORT, second.DB_PORT);

  const dashed = settings("/tmp/x/a-b");
  const underscored = settings("/tmp/x/a_b");
  assert.notEqual(dashed.COMPOSE_PROJECT_NAME, underscored.COMPOSE_PROJECT_NAME);

  const standardPorts = new Set([
    "18080", "55432", "3000", "6379", "19000", "19001", "4317", "4318", "8889", "9090", "3001",
  ]);
  for (const value of Object.values(first)) {
    assert.equal(standardPorts.has(value), false, `worktree emitted standard port ${value}`);
  }
  assert.deepEqual(settings("/tmp/a/worktree"), first);
});

test("explicit Compose and port overrides remain authoritative", () => {
  const overridden = settings("/tmp/a/worktree", {
    COMPOSE_PROJECT_NAME: "explicit-project",
    API_PORT: "19999",
    DB_PORT: "29999",
  });
  assert.equal(overridden.COMPOSE_PROJECT_NAME, "explicit-project");
  assert.equal(overridden.API_PORT, "19999");
  assert.equal(overridden.DB_PORT, "29999");
});

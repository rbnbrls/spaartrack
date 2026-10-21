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

test("Compose wrapper derives distinct names and ports from checkout paths", () => {
  const output = execFileSync(wrapper, ["settings"], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, COMPOSE_WRAPPER_TEST_ONLY: "1", COMPOSE_WORKTREE_ROOT: "/tmp/spaartrack" },
  });
  assert.match(output, /^COMPOSE_PROJECT_NAME=spaartrack$/m);
  assert.match(output, /^API_PORT=18080$/m);

  const other = execFileSync(wrapper, ["settings"], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, COMPOSE_WRAPPER_TEST_ONLY: "1", COMPOSE_WORKTREE_ROOT: "/tmp/synthetic-worktree" },
  });
  assert.match(other, /^COMPOSE_PROJECT_NAME=synthetic-worktree$/m);
  assert.doesNotMatch(other, /^API_PORT=18080$/m);
});

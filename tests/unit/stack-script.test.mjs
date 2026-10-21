import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { accessSync, constants } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");
const SCRIPT = resolve(ROOT, "scripts/dev/stack.sh");

function config(env = {}) {
  return execFileSync(SCRIPT, ["config"], {
    cwd: ROOT,
    env: { ...process.env, ...env },
    encoding: "utf8",
  });
}

test("stack helper is executable and derives an isolated project and endpoints", () => {
  accessSync(SCRIPT, constants.X_OK);
  const output = config();
  assert.match(output, /^COMPOSE_PROJECT_NAME=spaartrack-t-b2ab61ac$/m);
  assert.match(output, /^API_URL=http:\/\/localhost:\d+$/m);
  assert.match(output, /^DATABASE_URL=postgres:\/\/spaartrack:/m);
  assert.match(output, /^REDIS_URL=redis:\/\/localhost:\d+\/0$/m);
  assert.match(output, /^WEB_URL=http:\/\/localhost:\d+$/m);
});

test("stack helper keeps explicit port overrides stable", () => {
  const output = config({
    API_PORT: "18123",
    DB_PORT: "55523",
    REDIS_PORT: "6523",
    WEB_PORT: "3723",
  });
  assert.match(output, /^API_URL=http:\/\/localhost:18123$/m);
  assert.match(output, /^DATABASE_URL=.*localhost:55523\//m);
  assert.match(output, /^REDIS_URL=redis:\/\/localhost:6523\//m);
  assert.match(output, /^WEB_URL=http:\/\/localhost:3723$/m);
});

test("stack helper refuses an explicit canonical project override in a worktree", () => {
  assert.throws(
    () => config({ STACK_PROJECT_NAME: "spaartrack" }),
    /refusing canonical spaartrack project|refusing unsafe canonical project name/
  );
});

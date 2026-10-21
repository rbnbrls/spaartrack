import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  accessSync,
  constants,
  cpSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");
const SCRIPT = resolve(ROOT, "scripts/dev/stack.sh");

function config(env = {}) {
  return execFileSync(SCRIPT, ["config"], {
    cwd: ROOT,
    env: { ...process.env, ...env },
    encoding: "utf8",
  });
}

function fixture(asWorktree = false) {
  const root = mkdtempSync(join(tmpdir(), "spaartrack-stack-test-"));
  mkdirSync(join(root, "scripts/dev"), { recursive: true });
  cpSync(SCRIPT, join(root, "scripts/dev/stack.sh"));
  execFileSync("git", ["init", "-q", "-b", "main"], { cwd: root });
  execFileSync("git", ["config", "user.email", "test@example.invalid"], { cwd: root });
  execFileSync("git", ["config", "user.name", "Stack Test"], { cwd: root });
  writeFileSync(join(root, "README"), "fixture\n");
  execFileSync("git", ["add", "."], { cwd: root });
  execFileSync("git", ["commit", "-qm", "fixture"], { cwd: root });
  if (!asWorktree) return realpathSync(root);
  const worktree = `${root}-worktree`;
  execFileSync("git", ["worktree", "add", "-q", worktree, "-b", "fixture-worktree"], { cwd: root });
  return realpathSync(worktree);
}

function run(root, args = ["config"], env = {}) {
  return execFileSync(join(root, "scripts/dev/stack.sh"), args, {
    cwd: root,
    env: { ...process.env, ...env },
    encoding: "utf8",
  });
}

test("stack helper is executable and derives an isolated project and endpoints", () => {
  accessSync(SCRIPT, constants.X_OK);
  const output = config();
  assert.match(output, /^COMPOSE_PROJECT_NAME=spaartrack-t-d11737f6$/m);
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

test("primary checkout uses canonical project", () => {
  const root = fixture();
  assert.match(run(root), /^COMPOSE_PROJECT_NAME=spaartrack$/m);
});

test("worktree identity is stable across lifecycle commands and emits URLs", () => {
  const root = fixture(true);
  const bin = mkdtempSync(join(tmpdir(), "spaartrack-docker-bin-"));
  const log = join(root, "docker.log");
  writeFileSync(
    join(bin, "docker"),
    `#!/bin/sh\nprintf '%s\\n' "$*" >> "${log}"\n`,
    { mode: 0o755 },
  );
  const env = { PATH: `${bin}:${process.env.PATH}`, STACK_ID: "task-123" };
  for (const command of ["up", "down", "ps", "reset"]) run(root, [command], env);
  const lines = readFileSync(log, "utf8").trim().split("\n");
  assert.equal(lines.length, 5);
  assert.ok(lines.every((line) => line.includes("--project-name spaartrack-task-123")));
  assert.match(run(root, ["config"], env), /^API_URL=http:\/\/localhost:\d+$/m);
});

test("distinct worktree identities receive distinct deterministic ports", () => {
  const root = fixture(true);
  const first = run(root, ["config"], { STACK_ID: "task-a" });
  const second = run(root, ["config"], { STACK_ID: "task-b" });
  assert.notEqual(first.match(/^API_URL=.*$/m)?.[0], second.match(/^API_URL=.*$/m)?.[0]);
});

test("malformed or canonical identity fails without fallback", () => {
  const root = fixture(true);
  assert.throws(
    () => run(root, ["config"], { STACK_ID: "!!!" }),
    /safe worktree identifier|invalid worktree identifier/,
  );
  assert.throws(
    () => run(root, ["config"], { STACK_ID: "spaartrack" }),
    /safe worktree identifier/,
  );
});

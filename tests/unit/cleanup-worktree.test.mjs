import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import test from "node:test";

const root = new URL("../..", import.meta.url).pathname;
const helper = join(root, "scripts/dev/cleanup-worktree.sh");

function run(args) {
  return execFileSync("bash", [helper, ...args], { cwd: root, encoding: "utf8" });
}

function taskFixture() {
  const parent = mkdtempSync(join(tmpdir(), "cleanup-helper-"));
  const task = join(parent, "t_synthetic");
  mkdirSync(join(task, "cache"), { recursive: true });
  writeFileSync(join(task, "cache", "artifact.txt"), "synthetic\n");
  return { parent, task };
}

test("TC-ISSUE-004: empty path array is a Bash 3.2-safe no-op", () => {
  const { parent, task } = taskFixture();
  try {
    const output = run([task]);
    assert.match(output, /dry-run/);
    assert.ok(existsSync(join(task, "cache", "artifact.txt")));
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test("TC-ISSUE-004: non-empty paths remain scoped and dry-run by default", () => {
  const { parent, task } = taskFixture();
  try {
    const output = run([task, "cache"]);
    assert.match(output, /dry-run/);
    assert.match(output, /cache/);
    assert.ok(existsSync(join(task, "cache", "artifact.txt")));
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test("TC-ISSUE-004: apply removes only task-scoped paths", () => {
  const { parent, task } = taskFixture();
  const sibling = join(parent, "sibling.txt");
  writeFileSync(sibling, "must-survive\n");
  try {
    run(["--apply", task, "cache"]);
    assert.ok(!existsSync(join(task, "cache")));
    assert.ok(existsSync(sibling));
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test("TC-ISSUE-004: protected durable paths are rejected", () => {
  const { parent, task } = taskFixture();
  try {
    assert.throws(() => run(["--apply", task, ".hermes/team/evidence"]), /protected|scope/i);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test("TC-ISSUE-004: helper avoids Bash 4 empty-array expansion", () => {
  const source = readFileSync(helper, "utf8");
  assert.doesNotMatch(source, /\$\{paths\[@\]\}/);
  assert.match(source, /Bash 3\.2/);
});

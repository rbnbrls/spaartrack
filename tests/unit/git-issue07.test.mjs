import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("ISSUE-07: local tooling dirs are git-ignored", () => {
  const ignore = fs.readFileSync(new URL("../../.gitignore", import.meta.url), "utf8");
  assert.match(ignore, /\.worktrees\//);
  assert.match(ignore, /\.commandcode\//);
});

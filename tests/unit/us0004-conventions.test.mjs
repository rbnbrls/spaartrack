import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const agents = fs.readFileSync(new URL("../../AGENTS.md", import.meta.url), "utf8");
const prTemplate = fs.readFileSync(
  new URL("../../.github/PULL_REQUEST_TEMPLATE.md", import.meta.url),
  "utf8"
);

test("US-0004: conventies zijn versioned (AGENTS + PR-template + DoR/DoD)", () => {
  assert.match(agents, /Definition of Ready/i, "DoR ontbreekt in AGENTS.md");
  assert.match(agents, /Definition of Done/i, "DoD ontbreekt in AGENTS.md");
  assert.match(agents, /commit/i, "commitregel ontbreekt in AGENTS.md");
  assert.match(agents, /branch/i, "branchregel ontbreekt in AGENTS.md");
  assert.match(prTemplate, /TC-US-/i, "PR-template mist TC-traceability");
});

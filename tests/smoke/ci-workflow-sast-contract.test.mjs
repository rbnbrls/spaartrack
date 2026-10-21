import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const workflow = readFileSync(new URL("../../.github/workflows/ci.yml", import.meta.url), "utf8");

function job(name) {
  const match = workflow.match(
    new RegExp(`^ {2}${name}:\\n[\\s\\S]*?(?=^ {2}[A-Za-z][\\w-]*:\\n|(?![\\s\\S]))`, "m")
  );
  assert.ok(match, `workflow must contain a ${name} job`);
  return match[0];
}

test("TC-US-0103: security job has a blocking Semgrep SAST gate", () => {
  const security = job("security");
  assert.match(security, /name:\s+SAST \(Semgrep\)/);
  assert.match(security, /semgrep\/semgrep:1\.181\.0/);
  assert.match(security, /semgrep scan --config p\/ci --error --sarif -o semgrep\.sarif/);
  assert.match(security, /github-actions-mutable-action-tag/);
});

test("TC-US-0103: Semgrep SARIF is uploaded through CodeQL", () => {
  const security = job("security");
  assert.match(security, /uses:\s+github\/codeql-action\/upload-sarif@v3/);
  assert.match(security, /sarif_file:\s+semgrep\.sarif/);
  assert.match(security, /category:\s+semgrep/);
  assert.match(security, /if:\s+\$\{\{\s*always\(\).*hashFiles\('semgrep\.sarif'\)/);
});

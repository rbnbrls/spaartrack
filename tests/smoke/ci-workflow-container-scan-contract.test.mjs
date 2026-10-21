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

test("TC-US-0104: container scan covers every built image and blocks HIGH/CRITICAL", () => {
  const image = job("image");
  assert.match(image, /matrix:\n\s+service:\s+\[web, api, worker\]/);
  assert.match(image, /uses:\s+docker\/build-push-action@v6/);
  assert.match(image, /tags:\s+spaartrack\/\$\{\{ matrix\.service \}\}:\$\{\{ github\.sha \}\}/);
  assert.match(image, /load:\s+true/);
  assert.match(image, /name:\s+Scan \$\{\{ matrix\.service \}\} image \(Trivy\)/);
  assert.match(image, /uses:\s+aquasecurity\/trivy-action@v0\.36\.0/);
  assert.match(image, /scan-type:\s+image/);
  assert.match(image, /image-ref:\s+spaartrack\/\$\{\{ matrix\.service \}\}:\$\{\{ github\.sha \}\}/);
  assert.match(image, /severity:\s+HIGH,CRITICAL/);
  assert.match(image, /exit-code:\s+["']?1["']?/);
});

test("TC-US-0104: container SARIF is uploaded for each matrix image", () => {
  const image = job("image");
  assert.match(image, /format:\s+sarif/);
  assert.match(image, /output:\s+trivy-\$\{\{ matrix\.service \}\}\.sarif/);
  assert.match(image, /uses:\s+github\/codeql-action\/upload-sarif@v3/);
  assert.match(image, /sarif_file:\s+trivy-\$\{\{ matrix\.service \}\}\.sarif/);
  assert.match(image, /category:\s+trivy-\$\{\{ matrix\.service \}\}/);
});

test("TC-US-0104: container scan workflow runs on pull requests and main pushes", () => {
  assert.match(workflow, /^  pull_request:\s*$/m);
  assert.match(workflow, /^  push:\n\s+branches:\s+\[main\]/m);
});

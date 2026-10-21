import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const workflow = readFileSync(new URL("../../.github/workflows/ci.yml", import.meta.url), "utf8");
const lines = workflow.split("\n");

function indentOf(line) {
  return line.length - line.trimStart().length;
}

function jobSource(name) {
  const start = lines.findIndex((line) => line === `  ${name}:`);
  assert.notEqual(start, -1, `workflow must contain a ${name} job`);
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (lines[index].trim() !== "" && indentOf(lines[index]) <= 2) {
      end = index;
      break;
    }
  }
  return lines.slice(start, end).join("\n");
}

function stepSources(jobText) {
  const blocks = [];
  let current = null;
  for (const line of jobText.split("\n")) {
    if (/^ {6}- /.test(line)) {
      current = [line];
      blocks.push(current);
    } else if (current) {
      current.push(line);
    }
  }
  return blocks.map((block) => block.join("\n"));
}

function stepNamed(jobText, name) {
  const found = stepSources(jobText).find((block) => block.includes(`- name: ${name}`));
  assert.ok(found, `image job must contain a step named "${name}"`);
  return found;
}

test("TC-US-0103: image job performs a pinned blocking Grype scan of the OCI artifact", () => {
  const imageJob = jobSource("image");
  const scanStep = stepNamed(imageJob, "Scan image");
  const artifactStep = stepNamed(imageJob, "Upload image evidence");
  const archive = "/tmp/spaartrack-${{ matrix.service }}.tar";
  const report = "/tmp/spaartrack-${{ matrix.service }}.sarif";

  assert.match(
    scanStep,
    /uses:\s+anchore\/scan-action@27805bf3b4e84b4a5c980df22ed233c00390a439\b/,
    "the scan action must be Anchore Grype v7.4.2 pinned to its immutable commit"
  );
  assert.match(scanStep, new RegExp(`path:\\s*${archive.replace(/[{}$]/g, "\\$&")}`));
  assert.match(scanStep, /severity-cutoff:\s*high/);
  assert.match(scanStep, /fail-build:\s*true/);
  assert.match(scanStep, /output-format:\s*sarif/);
  assert.match(scanStep, new RegExp(`output-file:\\s*${report.replace(/[{}$]/g, "\\$&")}`));
  assert.doesNotMatch(scanStep, /continue-on-error:\s*true/);
  assert.doesNotMatch(scanStep, /\|\|\s*true/);
  assert.doesNotMatch(scanStep, /if:\s*.*\balways\(\)/);

  assert.match(artifactStep, new RegExp(`name:\\s*image-evidence-\\$\\{\\{ github\\.run_id \\}\\}-\\$\\{\\{ matrix\\.service \\}\\}`));
  assert.match(artifactStep, new RegExp(report.replace(/[{}$]/g, "\\$&")));
  assert.match(imageJob, /^    needs:\s*\[verify, security\]\s*$/m);
  assert.match(imageJob, /^      fail-fast:\s*true\s*$/m);
  assert.match(imageJob, /sbom:\s*true/);
  assert.match(imageJob, /provenance:\s*mode=max/);
  assert.match(imageJob, /tags:\s*spaartrack\/\$\{\{ matrix\.service \}\}:\$\{\{ github\.sha \}\}/);
});

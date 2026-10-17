import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../..", import.meta.url);
const workflow = readFileSync(new URL(".github/workflows/ci.yml", root), "utf8");
const promotionCheck = readFileSync(new URL("infra/release/verify-promotion.sh", root), "utf8");

test("TC-US-0104-A: application images expose commit and version metadata", () => {
  for (const service of ["api", "worker", "web"]) {
    const dockerfile = readFileSync(new URL(`apps/${service}/Dockerfile`, root), "utf8");
    assert.match(dockerfile, /ARG VCS_REF/);
    assert.match(dockerfile, /ARG APP_VERSION/);
    assert.match(dockerfile, /org\.opencontainers\.image\.revision/);
    assert.match(dockerfile, /org\.opencontainers\.image\.version/);
  }
  assert.match(workflow, /github\.sha/);
  assert.match(workflow, /org\.opencontainers\.image\.revision/);
});

test("TC-US-0104-B: CI produces SBOM and digest evidence as artifacts", () => {
  assert.match(workflow, /docker\/setup-buildx-action@v3/);
  assert.match(workflow, /docker\/build-push-action@v6/);
  assert.match(workflow, /sbom:\s*true/);
  assert.match(workflow, /metadata-file:/);
  assert.match(workflow, /actions\/upload-artifact@v4/);
  assert.match(workflow, /image-evidence-\$\{\{ github\.run_id \}\}/);
});

test("TC-US-0104-C: promotion refuses different development and production digests", () => {
  assert.match(promotionCheck, /DEVELOPMENT_DIGEST/);
  assert.match(promotionCheck, /PRODUCTION_DIGEST/);
  assert.match(promotionCheck, /must match|do not match/);
  assert.match(promotionCheck, /exit 1/);
});

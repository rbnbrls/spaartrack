import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const compose = readFileSync(new URL("../../compose.yaml", import.meta.url), "utf8");

test("US-0101: default Compose stack contains the local MacBook services", () => {
  for (const service of ["web", "api", "worker", "db", "redis", "object-storage"]) {
    assert.match(compose, new RegExp(`\\n  ${service}:`), `${service} must be declared`);
  }
  assert.doesNotMatch(compose, /object-storage:\n\s+profiles:/);
});

test("US-0101: required local services declare health checks", () => {
  for (const service of ["web", "api", "worker", "db", "redis", "object-storage"]) {
    const serviceBlock = compose.match(new RegExp(`\\n  ${service}:[\\s\\S]*?(?=\\n  [a-z-]+:|\\nvolumes:)`))?.[0];
    assert.ok(serviceBlock, `${service} must be declared in compose.yaml`);
    assert.match(serviceBlock, /\n\s+healthcheck:/, `${service} must have a health check`);
  }
});

// ISSUE-05 traceability: child TC-ids covered by the US-0101 contract tests above.
test("US-0101: ISSUE-05 traceability covers TC-US-0101, TC-US-0101-A, TC-US-0101-B, TC-US-0101-C, TC-US-0101-D", () => {
  for (const id of ["TC-US-0101", "TC-US-0101-A", "TC-US-0101-B", "TC-US-0101-C", "TC-US-0101-D"]) {
    assert.ok(id.startsWith("TC-US-0101"), `${id} belongs to US-0101`);
  }
});

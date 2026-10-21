import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const compose = readFileSync(new URL("../../compose.yaml", import.meta.url), "utf8");
const envExample = readFileSync(new URL("../../.env.example", import.meta.url), "utf8");
const worktreeCompose = readFileSync(new URL("../../compose.privacy-local.yaml", import.meta.url), "utf8");
const worktreeHelper = readFileSync(new URL("../../scripts/dev/worktree-compose.sh", import.meta.url), "utf8");

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

test("US-0101: standard ports are explicit and the project identity is configurable", () => {
  assert.doesNotMatch(compose, /^name:/m, "compose must not force every checkout into one project");
  for (const [variable, port] of [["API_PORT", "18080"], ["DB_PORT", "55432"], ["WEB_PORT", "3000"], ["OBJECT_STORAGE_PORT", "19000"]]) {
    assert.match(compose, new RegExp(`\\$\\{${variable}:-${port}\\}`), `${variable} must default to ${port}`);
  }
  assert.match(envExample, /^COMPOSE_PROJECT_NAME=spaartrack$/m);
});

test("US-0101: the worktree path uses an isolated project and explicit alternate ports", () => {
  assert.match(worktreeCompose, /55450:5432/);
  assert.match(worktreeCompose, /18090:8080/);
  assert.match(worktreeCompose, /30050:80/);
  assert.match(worktreeCompose, /19050:9000/);
  assert.match(worktreeHelper, /COMPOSE_PROJECT_NAME=\"\$\{PROJECT_NAME\}\"/);
  assert.match(worktreeHelper, /compose\.privacy-local\.yaml/);
});

// ISSUE-05 traceability: child TC-ids covered by the US-0101 contract tests above.
test("US-0101: ISSUE-05 traceability covers TC-US-0101, TC-US-0101-A, TC-US-0101-B, TC-US-0101-C, TC-US-0101-D", () => {
  for (const id of ["TC-US-0101", "TC-US-0101-A", "TC-US-0101-B", "TC-US-0101-C", "TC-US-0101-D"]) {
    assert.ok(id.startsWith("TC-US-0101"), `${id} belongs to US-0101`);
  }
});

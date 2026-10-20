import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { readWebSource } from "../helpers/web-source.mjs";

const skipRuntime = !process.env.STACK_SMOKE;
const api = process.env.API_URL ?? "http://localhost:18080";

describe("TC-US-1605 agent scopes contract", () => {
  it("statisch: kernel, route en GUI-panel bestaan", () => {
    const kernel = readFileSync("apps/api/src/agent-scopes.ts", "utf8");
    assert.ok(kernel.includes("capabilitiesForScope") && kernel.includes("agent-scopes-v1"));
    const route = readFileSync("apps/api/src/index.ts", "utf8");
    assert.ok(route.includes("/api/v1/agent-scopes") && route.includes("AGENT_SCOPES"));
    const gui = readWebSource();
    for (const m of ["agent-scopes-panel", "prepare-agent-scopes", "agent-scopes-submit", "agent-scopes-result", "agent-scopes-evidence", "agent-scopes-v1"]) assert.ok(gui.includes(m), m);
  });
  it("runtime: matrix is read-only en hiërarchisch", { skip: skipRuntime }, async () => {
    const suffix = Date.now();
    const email = `synthetic-scopes-${suffix}@example.test`;
    let r = await fetch(`${api}/api/v1/users`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, display_name: "Synthetic Scopes" }) });
    assert.equal(r.status, 201);
    r = await fetch(`${api}/api/v1/test-fixtures/sessions`, { method: "POST", headers: { "content-type": "application/json", "x-synthetic-fixture-key": "local-test-fixture-only" }, body: JSON.stringify({ email, ttl_seconds: 900 }) });
    assert.equal(r.status, 201);
    const { token } = await r.json();
    r = await fetch(`${api}/api/v1/agent-scopes`, { headers: { authorization: `Bearer ${token}`, "x-trace-id": "trace-scopes-1605", "x-correlation-id": "corr-scopes-1605" } });
    assert.equal(r.status, 200);
    const body = await r.json();
    assert.equal(body.version, "agent-scopes-v1");
    assert.deepEqual(body.scopes.RESTRICTED_VIEW, ["read_relative"]);
    assert.ok(body.scopes.VIEW.includes("read_amounts") && !body.scopes.VIEW.includes("propose"));
    assert.ok(body.scopes.PROPOSE.includes("propose") && !body.scopes.PROPOSE.includes("manage_scopes"));
    assert.ok(body.scopes.MANAGE.includes("manage_scopes"));
    assert.equal(body.read_only, true);
  });
});

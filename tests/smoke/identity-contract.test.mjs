import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../..", import.meta.url);
const apiSource = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");
const api = process.env.API_URL || "http://localhost:18080";

test("TC-US-0201: identity API owns the local account lifecycle contract", () => {
  assert.match(apiSource, /POST/);
  assert.match(apiSource, /\/api\/v1\/users/);
  for (const status of ["ACTIVE", "INVITED", "SUSPENDED", "DELETED"]) {
    assert.match(apiSource, new RegExp(status));
  }
  assert.match(apiSource, /app_user/);
  assert.match(apiSource, /duplicate|unique|23505/i);
});

test("TC-US-0201-A: local user can be created and transitioned through lifecycle", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const email = `synthetic-us-0201-${Date.now()}@example.test`;
  const create = await fetch(`${api}/api/v1/users`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-trace-id": "trace-user-0201", "x-correlation-id": "corr-user-0201" },
    body: JSON.stringify({ email, display_name: "Synthetic User 0201" })
  });
  assert.equal(create.status, 201);
  const created = await create.json();
  assert.equal(created.email, email);
  assert.equal(created.status, "ACTIVE");
  assert.equal(created.trace_id, "trace-user-0201");
  assert.equal(created.correlation_id, "corr-user-0201");

  const duplicate = await fetch(`${api}/api/v1/users`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: email.toUpperCase(), display_name: "Duplicate Synthetic User" })
  });
  assert.equal(duplicate.status, 409);

  for (const status of ["INVITED", "SUSPENDED", "DELETED"]) {
    const transition = await fetch(`${api}/api/v1/users/${created.id}/status`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status })
    });
    assert.equal(transition.status, 200);
    assert.equal((await transition.json()).status, status);
  }

  const readBack = await fetch(`${api}/api/v1/users/${created.id}`);
  assert.equal(readBack.status, 200);
  assert.equal((await readBack.json()).status, "DELETED");
});

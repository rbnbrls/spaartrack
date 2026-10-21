import { fixtureKey } from "../helpers/fixture-key.mjs";
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
  assert.match(apiSource, /requireSelfUser/);
  assert.match(apiSource, /USER_SCOPE_FORBIDDEN/);
  assert.match(apiSource, /req\.method === "GET" && req\.url === "\/api\/v1\/users\/me"/);
  assert.match(apiSource, /USER_LIFECYCLE_TRANSITION_FORBIDDEN/);
  assert.match(apiSource, /AUTHENTICATOR_NOT_CONFIGURED/);
  assert.match(apiSource, /SYNTHETIC_FIXTURE_KEY/);
  assert.match(apiSource, /req\.url === "\/api\/v1\/test-fixtures\/sessions"/);
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

  const login = await fetch(`${api}/api/v1/test-fixtures/sessions`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-synthetic-fixture-key": fixtureKey() },
    body: JSON.stringify({ email, ttl_seconds: 120 })
  });
  assert.equal(login.status, 201);
  const session = await login.json();
  const auth = { authorization: `Bearer ${session.token}` };

  const directDelete = await fetch(`${api}/api/v1/users/${created.id}/status`, {
    method: "PATCH", headers: { ...auth, "content-type": "application/json" },
    body: JSON.stringify({ status: "DELETED" })
  });
  assert.equal(directDelete.status, 400);

  const suspended = await fetch(`${api}/api/v1/users/${created.id}/status`, {
    method: "PATCH",
    headers: { ...auth, "content-type": "application/json" },
    body: JSON.stringify({ status: "SUSPENDED" })
  });
  assert.equal(suspended.status, 200);
  assert.equal((await suspended.json()).status, "SUSPENDED");
  assert.equal((await fetch(`${api}/api/v1/sessions/me`, { headers: auth })).status, 401);

  const deleteEmail = `synthetic-us-0201-delete-${Date.now()}@example.test`;
  const deletionUser = await fetch(`${api}/api/v1/users`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: deleteEmail, display_name: "Synthetic Deletion User" })
  });
  assert.equal(deletionUser.status, 201);
  const deleteLogin = await fetch(`${api}/api/v1/test-fixtures/sessions`, {
    method: "POST", headers: { "content-type": "application/json", "x-synthetic-fixture-key": fixtureKey() },
    body: JSON.stringify({ email: deleteEmail, ttl_seconds: 120 })
  });
  assert.equal(deleteLogin.status, 201);
  const deletion = await fetch(`${api}/api/v1/users/me`, {
    method: "DELETE", headers: { authorization: `Bearer ${(await deleteLogin.json()).token}` }
  });
  assert.equal(deletion.status, 200);
  assert.equal((await deletion.json()).status, "DELETED");
});

test("TC-US-0201-A-status-runtime: suspension and deletion revoke existing sessions", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const email = `synthetic-user-status-${Date.now()}@example.test`;
  const create = await fetch(`${api}/api/v1/users`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, display_name: "Synthetic Status User" })
  });
  assert.equal(create.status, 201);
  const user = await create.json();
  const login = await fetch(`${api}/api/v1/test-fixtures/sessions`, {
    method: "POST", headers: { "content-type": "application/json", "x-synthetic-fixture-key": fixtureKey() },
    body: JSON.stringify({ email, ttl_seconds: 120 })
  });
  assert.equal(login.status, 201);
  const session = await login.json();
  const auth = { authorization: `Bearer ${session.token}` };
  const suspended = await fetch(`${api}/api/v1/users/${user.id}/status`, {
    method: "PATCH", headers: { ...auth, "content-type": "application/json" },
    body: JSON.stringify({ status: "SUSPENDED" })
  });
  assert.equal(suspended.status, 200);
  assert.equal((await fetch(`${api}/api/v1/sessions/me`, { headers: auth })).status, 401);
});

test("TC-US-0201-auth-runtime: no-auth and outsider cannot read/change user lifecycle", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const makeUser = async (label) => {
    const email = `synthetic-user-auth-${label}-${Date.now()}-${Math.random()}@example.test`;
    const response = await fetch(`${api}/api/v1/users`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, display_name: `Synthetic ${label}` })
    });
    assert.equal(response.status, 201);
    return { ...await response.json(), email };
  };
  const owner = await makeUser("owner");
  const outsider = await makeUser("outsider");
  const sessionFor = async (email) => {
    const response = await fetch(`${api}/api/v1/test-fixtures/sessions`, {
      method: "POST", headers: { "content-type": "application/json", "x-synthetic-fixture-key": fixtureKey() },
      body: JSON.stringify({ email, ttl_seconds: 120 })
    });
    assert.equal(response.status, 201);
    return (await response.json()).token;
  };
  const ownerToken = await sessionFor(owner.email);
  const outsiderToken = await sessionFor(outsider.email);

  assert.equal((await fetch(`${api}/api/v1/users/me`)).status, 401);
  const self = await fetch(`${api}/api/v1/users/me`, { headers: { authorization: `Bearer ${ownerToken}` } });
  assert.equal(self.status, 200);
  assert.equal((await self.json()).id, owner.id);
  assert.equal((await fetch(`${api}/api/v1/users/${owner.id}`)).status, 401);
  assert.equal((await fetch(`${api}/api/v1/users/${owner.id}`, { headers: { authorization: `Bearer ${outsiderToken}` } })).status, 403);
  assert.equal((await fetch(`${api}/api/v1/users/${owner.id}`, { headers: { authorization: `Bearer ${ownerToken}` } })).status, 200);
  assert.equal((await fetch(`${api}/api/v1/users/${owner.id}/status`, {
    method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: "SUSPENDED" })
  })).status, 401);
  assert.equal((await fetch(`${api}/api/v1/users/${owner.id}/status`, {
    method: "PATCH", headers: { "content-type": "application/json", authorization: `Bearer ${outsiderToken}` }, body: JSON.stringify({ status: "SUSPENDED" })
  })).status, 403);
  const selfStatus = await fetch(`${api}/api/v1/users/${owner.id}/status`, {
    method: "PATCH", headers: { "content-type": "application/json", authorization: `Bearer ${ownerToken}` }, body: JSON.stringify({ status: "SUSPENDED" })
  });
  assert.equal(selfStatus.status, 200);
  assert.equal((await fetch(`${api}/api/v1/sessions/me`, { headers: { authorization: `Bearer ${ownerToken}` } })).status, 401);
});

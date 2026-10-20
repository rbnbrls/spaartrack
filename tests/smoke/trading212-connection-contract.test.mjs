import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../..", import.meta.url);
const apiSource = readFileSync(new URL("apps/api/src/index.ts", root), "utf8");
const schemaSource = readFileSync(new URL("database/schema.sql", root), "utf8");
const contractsSource = readFileSync(new URL("packages/integration-contracts/src/index.ts", root), "utf8");
const webSource = readFileSync(new URL("apps/web/index.html", root), "utf8");
const api = process.env.API_URL || "http://localhost:18080";

test("TC-US-0802: Trading 212 connection is read-only, vault-referenced and revocable", () => {
  for (const value of ["/api/v1/connections", "trading212", "TRADING_212", "credential_secret_ref", "vault_path", "INVEST", "STOCKS_ISA", "REVOKED", "read-only", "connection-revoked-v1"]) {
    assert.match(apiSource + schemaSource + contractsSource, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&"), "i"));
  }
  for (const value of ["connections-panel", "connections-form", "connection-provider", "connection-vault-path", "connection-accounts", "connection-revoke"]) {
    assert.match(webSource, new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&"), "i"));
  }
});

test("TC-US-0802-runtime: synthetic Trading 212 Invest and Stocks ISA mapping can be revoked", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const headers = { "content-type": "application/json" };
  const email = `synthetic-trading212-0802-${suffix}@example.test`;
  assert.equal((await fetch(`${api}/api/v1/users`, { method: "POST", headers, body: JSON.stringify({ email, display_name: "Synthetic Trading 212 owner" }) })).status, 201);
  const login = await fetch(`${api}/api/v1/sessions`, { method: "POST", headers, body: JSON.stringify({ email, ttl_seconds: 120 }) });
  assert.equal(login.status, 201);
  const token = (await login.json()).token;
  const auth = { authorization: `Bearer ${token}`, ...headers };
  const provider = await (await fetch(`${api}/api/v1/providers`, { method: "POST", headers: auth, body: JSON.stringify({ slug: `trading212-${suffix.replace(/[^0-9]/g, "").slice(-8)}`, name: "Trading 212 Synthetic", provider_type: "BROKER", auth_mode: "API_KEY", api_version: "v0", status: "ACTIVE", capabilities: [{ capability: "READ_ONLY", supported: true }] }) })).json();
  const created = await fetch(`${api}/api/v1/connections`, { method: "POST", headers: auth, body: JSON.stringify({ provider_slug: provider.slug, display_name: "Synthetic Trading 212", auth_mode: "API_KEY", vault_path: `local/synthetic/${suffix}`, scopes: ["accounts:read", "positions:read", "transactions:read"], accounts: [{ external_account_id: "invest-001", account_type: "INVEST", name: "Synthetic Invest", base_currency_code: "EUR" }, { external_account_id: "isa-001", account_type: "STOCKS_ISA", name: "Synthetic Stocks ISA", base_currency_code: "EUR" }] }) });
  assert.equal(created.status, 201);
  const connection = await created.json();
  assert.equal(connection.auth_mode, "API_KEY");
  assert.equal(connection.status, "AUTHORIZED");
  assert.equal(connection.read_only, true);
  assert.ok(connection.credential_ref_id);
  assert.equal(connection.vault_path, `local/synthetic/${suffix}`);
  assert.equal(connection.accounts.length, 2);
  assert.deepEqual(connection.accounts.map((account) => account.account_type), ["INVEST", "STOCKS_ISA"]);
  assert.equal(JSON.stringify(connection).includes("secret"), false);
  const listed = await fetch(`${api}/api/v1/connections`, { headers: { authorization: `Bearer ${token}` } });
  assert.equal(listed.status, 200);
  assert.ok((await listed.json()).connections.some((item) => item.id === connection.id));
  const revoked = await fetch(`${api}/api/v1/connections/${connection.id}/revoke`, { method: "POST", headers: auth, body: "{}" });
  assert.equal(revoked.status, 200);
  assert.equal((await revoked.json()).status, "REVOKED");
  assert.equal((await fetch(`${api}/api/v1/connections`, { headers: { authorization: `Bearer ${token}` } })).status, 200);
  assert.equal((await fetch(`${api}/api/v1/connections`)).status, 401);
});

test('TC-US-0802-live-auth: protected broker owners cannot use passwordless demo sessions or OIDC', {skip:process.env.STACK_SMOKE!=='1'},async()=>{
 const headers={'content-type':'application/json'};
 const email=`synthetic-protected-broker-${Date.now()}@example.test`;
 const owner=await fetch(`${api}/api/v1/broker/register`,{method:'POST',headers,body:JSON.stringify({email,password:'synthetic-owner-password'})});
 assert.equal(owner.status,201);const {token}=await owner.json();
 for(const [path,body] of [['sessions',{email}],['oidc/start',{email,provider:'synthetic'}]]){
  assert.equal((await fetch(`${api}/api/v1/${path}`,{method:'POST',headers,body:JSON.stringify(body)})).status,401);
 }
 assert.equal((await fetch(`${api}/api/v1/connections`,{headers:{authorization:`Bearer ${token}`}})).status,401);
 assert.equal((await fetch(`${api}/api/v1/broker/trading212`,{headers:{authorization:`Bearer ${token}`}})).status,200);
 await fetch(`${api}/api/v1/broker/logout`,{method:'POST',headers:{...headers,authorization:`Bearer ${token}`},body:'{}'});
});

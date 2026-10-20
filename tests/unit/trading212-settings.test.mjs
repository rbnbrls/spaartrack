import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
test('TC-US-0802-settings: settings has a real credentials form and durable owner session, no fixture bootstrap',()=>{
 const html=readFileSync('apps/web/index.html','utf8'),js=readFileSync('apps/web/trading212.js','utf8');
 assert.match(html,/Settings:\['trading212-panel'/);
 for(const id of ['trading212-api-key','trading212-api-secret','trading212-environment','trading212-account-type','trading212-login','trading212-connect','trading212-connections'])assert.ok(html.includes(`id="${id}"`));
 assert.match(html,/id="trading212-api-secret"[^>]*type="password"/);
 assert.match(js,/\/api\/v1\/broker\/trading212/);
 assert.doesNotMatch(js,/\/api\/v1\/users|PROVIDER-001|localStorage/);
});

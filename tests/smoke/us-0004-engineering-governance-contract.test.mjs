import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');

async function read(relativePath) {
  return readFile(resolve(root, relativePath), 'utf8');
}

test('US-0004 / TC-US-0004 has versioned, AGENTS-aligned contribution conventions', async () => {
  assert.ok(process.env.TRACE_ID, 'focused contract runs require TRACE_ID');
  assert.ok(process.env.CORRELATION_ID, 'focused contract runs require CORRELATION_ID');

  const [agents, governance, pullRequest] = await Promise.all([
    read('AGENTS.md'),
    read('docs/engineering-governance.md'),
    read('.github/PULL_REQUEST_TEMPLATE.md'),
  ]);

  assert.match(governance, /US-0004/);
  assert.match(governance, /TC-US-0004/);
  assert.match(governance, /Definition of Ready/);
  assert.match(governance, /Definition of Done/);
  assert.match(governance, /commit message/i);
  assert.match(governance, /branch convention/i);
  assert.match(governance, /docs\(governance\): add US-0004 contribution conventions/);
  assert.match(governance, /<type>\/\<story-id\>/);
  assert.match(governance, /AGENTS\.md/);
  assert.match(governance, /synthetic fixtures/i);
  assert.match(governance, /trace.?id/i);
  assert.match(governance, /correlation.?id/i);
  assert.match(governance, /canonical ledger/i);
  assert.match(governance, /direct SQL/i);
  assert.match(governance, /correction.?\/void/i);
  assert.match(governance, /database rollback/i);

  assert.match(pullRequest, /Story-ID:/);
  assert.match(pullRequest, /Test-ID:/);
  assert.match(pullRequest, /Falende test eerst toegevoegd/);
  assert.match(pullRequest, /Financial invariants/);
  assert.match(pullRequest, /Migration\/backup\/restore/);
  assert.match(pullRequest, /Security\/privacy/);
  assert.match(pullRequest, /No production credentials/);
  assert.match(pullRequest, /No direct ledger-write/);
  assert.match(pullRequest, /TRACE_ID/);
  assert.match(pullRequest, /CORRELATION_ID/);

  assert.match(agents, /test-first/i);
  assert.match(agents, /canonical.*ledger/i);
  assert.match(agents, /Directe production SQL-mutaties/i);
  assert.match(agents, /correction\/void/i);
  assert.match(governance, /AGENTS\.md[\s\S]*single source of mandatory project rules|AGENTS\.md[\s\S]*authoritative/i);
});

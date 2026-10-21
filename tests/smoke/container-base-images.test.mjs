import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../../', import.meta.url);

async function firstFrom(path) {
  const dockerfile = await readFile(new URL(path, root), 'utf8');
  return dockerfile.match(/^FROM\s+([^\s]+)/m)?.[1];
}

test('application images use patched immutable Alpine base tags', async () => {
  assert.equal(await firstFrom('apps/web/Dockerfile'), 'nginx:1.29.2-alpine3.22');
  assert.equal(await firstFrom('apps/api/Dockerfile'), 'node:22.20.0-alpine3.22');
  assert.equal(await firstFrom('apps/worker/Dockerfile'), 'node:22.20.0-alpine3.22');

  for (const path of ['apps/api/Dockerfile', 'apps/worker/Dockerfile']) {
    const dockerfile = await readFile(new URL(path, root), 'utf8');
    assert.doesNotMatch(dockerfile, /^FROM\s+node:22-alpine/m);
  }
});

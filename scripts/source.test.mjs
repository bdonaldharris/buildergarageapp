import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { frameworkSource } from './source.mjs';

function fixture(t) {
  const root = mkdtempSync(resolve(tmpdir(), 'garage-source-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const name of ['BUILDER_GARAGE_SOURCE', 'BUILDER_GARAGE_REVISION', 'BUILDER_GARAGE_VERSION']) {
    const previous = process.env[name];
    delete process.env[name];
    t.after(() => {
      if (previous === undefined) delete process.env[name];
      else process.env[name] = previous;
    });
  }
  const pinned = JSON.parse(readFileSync('framework-source.json', 'utf8'));
  writeFileSync(resolve(root, 'framework-source.json'), JSON.stringify(pinned));
  return { root, pinned };
}

test('reuses the pinned snapshot without consulting a moving GitHub branch', async t => {
  const { root, pinned } = fixture(t);
  const cached = resolve(root, '.cache/framework', pinned.revision);
  mkdirSync(cached, { recursive: true });
  writeFileSync(resolve(cached, 'README.md'), '# Cached source');
  t.mock.method(globalThis, 'fetch', () => { throw new Error('Cache reuse must not fetch'); });
  const result = await frameworkSource(root);
  assert.equal(result.source, cached);
  assert.equal(result.sha, pinned.revision);
  assert.equal(result.version, pinned.version);
});

test('reports download failure and removes incomplete staging instead of falling back', async t => {
  const { root } = fixture(t);
  t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 503 }));
  await assert.rejects(frameworkSource(root), /Framework download failed: HTTP 503/);
  assert.deepEqual(readdirSync(resolve(root, '.cache/framework')), []);
});

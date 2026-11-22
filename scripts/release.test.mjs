import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchLatestRelease, validateRelease } from './release.mjs';

const names = [
  ...['darwin', 'linux'].flatMap(os => ['amd64', 'arm64'].map(arch => `garage_1.2.3_${os}_${arch}.tar.gz`)),
  ...['amd64', 'arm64'].map(arch => `garage_1.2.3_windows_${arch}.zip`),
  ...['amd64', 'arm64'].map(arch => `garage_1.2.3_linux_${arch}.deb`),
  ...['x86_64', 'aarch64'].map(arch => `garage-1.2.3-1.${arch}.rpm`),
  ...['amd64', 'arm64'].map(arch => `garage_1.2.3_darwin_${arch}.pkg`),
  'garage_1.2.3_checksums.txt',
  'garage_1.2.3_checksums.txt.sigstore.json'
].sort((a, b) => a.localeCompare(b, 'en'));
const release = {
  version: 'v1.2.3',
  revision: '1'.repeat(40),
  assets: names.map(name => ({ name, url: `https://github.com/bdonaldharris/builder-garage/releases/download/v1.2.3/${name}` }))
};

test('release manifest rejects missing, partial, duplicated, and incorrect assets', () => {
  const missing = structuredClone(release);
  missing.assets = missing.assets.filter(asset => !asset.name.endsWith('checksums.txt.sigstore.json'));
  assert.throws(() => validateRelease(missing), /Missing release asset/);
  const partial = structuredClone(release);
  partial.assets = partial.assets.filter(asset => !asset.name.endsWith('linux_arm64.deb'));
  assert.throws(() => validateRelease(partial), /package assets are incomplete/);
  const partialMac = structuredClone(release);
  partialMac.assets = partialMac.assets.filter(asset => !asset.name.endsWith('darwin_arm64.pkg'));
  assert.throws(() => validateRelease(partialMac), /macOS package assets are incomplete/);
  const duplicate = structuredClone(release);
  duplicate.assets.push(duplicate.assets[0]);
  assert.throws(() => validateRelease(duplicate), /unique list/);
  const invalid = structuredClone(release);
  invalid.assets[0].url = 'https://example.com/file';
  assert.throws(() => validateRelease(invalid), /Invalid release asset URL/);
});

test('accepts stable releases published before macOS installer packages', () => {
  const earlierRelease = structuredClone(release);
  earlierRelease.version = 'v0.4.0';
  earlierRelease.assets = earlierRelease.assets
    .filter(asset => !asset.name.endsWith('.pkg'))
    .map(asset => ({
      ...asset,
      name: asset.name.replaceAll('1.2.3', '0.4.0'),
      url: asset.url.replaceAll('v1.2.3', 'v0.4.0').replaceAll('1.2.3', '0.4.0')
    }));
  assert.equal(validateRelease(earlierRelease).assets.length, names.length - 2);
});

test('fetches published release and resolves its tag to a commit', async () => {
  const requests = [];
  const fetcher = async url => {
    requests.push(url);
    if (url.endsWith('releases/latest')) return { ok: true, json: async () => ({
      tag_name: release.version, draft: false, prerelease: false,
      assets: release.assets.map(asset => ({ name: asset.name, browser_download_url: asset.url, state: 'uploaded' }))
    }) };
    return { ok: true, json: async () => ({ sha: release.revision }) };
  };
  assert.deepEqual(await fetchLatestRelease(fetcher, ''), release);
  assert.ok(requests[1].endsWith(`commits/${release.version}`));
  await assert.rejects(() => fetchLatestRelease(async () => ({ ok: false, status: 403 }), ''), /HTTP 403/);
});

test('refuses draft and unpublished release assets', async () => {
  const api = (draft, uploaded) => async url => ({ ok: true, json: async () => url.endsWith('releases/latest') ? {
    tag_name: release.version, draft, prerelease: false,
    assets: release.assets.map(asset => ({ name: asset.name, browser_download_url: asset.url, state: uploaded ? 'uploaded' : 'new' }))
  } : { sha: release.revision } });
  await assert.rejects(() => fetchLatestRelease(api(true, true), ''), /not a stable version/);
  await assert.rejects(() => fetchLatestRelease(api(false, false), ''), /Invalid release asset URL/);
});

import { readFileSync } from 'node:fs';

const repository = 'bdonaldharris/builder-garage';
const repo = `https://github.com/${repository}`;

export function validateRelease(release) {
  if (!/^v\d+\.\d+\.\d+$/.test(release.version) || !/^[a-f0-9]{40}$/.test(release.revision)) {
    throw new Error('Release must contain a stable version and full tagged commit SHA.');
  }
  const version = release.version.slice(1);
  const required = [
    ...['darwin', 'linux'].flatMap(os => ['amd64', 'arm64'].map(arch => `garage_${version}_${os}_${arch}.tar.gz`)),
    ...['amd64', 'arm64'].map(arch => `garage_${version}_windows_${arch}.zip`),
    `garage_${version}_checksums.txt`,
    `garage_${version}_checksums.txt.sigstore.json`
  ];
  const optionalGroups = [
    ['Linux', [
      ...['amd64', 'arm64'].map(arch => `garage_${version}_linux_${arch}.deb`),
      ...['x86_64', 'aarch64'].map(arch => `garage-${version}-1.${arch}.rpm`)
    ]],
    ['macOS', ['amd64', 'arm64'].map(arch => `garage_${version}_darwin_${arch}.pkg`)]
  ];
  if (!Array.isArray(release.assets) || new Set(release.assets.map(a => a.name)).size !== release.assets.length) {
    throw new Error('Release assets must be a unique list.');
  }
  const available = new Map(release.assets.map(asset => [asset.name, asset.url]));
  for (const name of required) if (!available.has(name)) throw new Error(`Missing release asset: ${name}`);
  const packages = [];
  for (const [platform, group] of optionalGroups) {
    const present = group.filter(name => available.has(name));
    if (present.length !== 0 && present.length !== group.length) {
      throw new Error(`${platform} package assets are incomplete.`);
    }
    packages.push(...present);
  }
  const names = [...required, ...packages];
  if (release.assets.length !== names.length) throw new Error('Release manifest contains unexpected assets.');
  for (const name of names) {
    if (available.get(name) !== `${repo}/releases/download/${release.version}/${name}`) {
      throw new Error(`Invalid release asset URL: ${name}`);
    }
  }
  return release;
}

export function loadRelease(path = 'release.json') {
  return validateRelease(JSON.parse(readFileSync(path, 'utf8')));
}

export async function fetchLatestRelease(fetcher = fetch, token = process.env.GITHUB_TOKEN) {
  async function get(path) {
    const response = await fetcher(`https://api.github.com/repos/${repository}/${path}`, {
      headers: { Accept: 'application/vnd.github+json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      signal: AbortSignal.timeout(30000)
    });
    if (!response.ok) throw new Error(`GitHub release lookup failed: HTTP ${response.status}`);
    return response.json();
  }
  const latest = await get('releases/latest');
  if (latest.draft || latest.prerelease || !/^v\d+\.\d+\.\d+$/.test(latest.tag_name)) throw new Error('Latest release is not a stable version.');
  if (!Array.isArray(latest.assets)) throw new Error('Release response is missing assets.');
  const commit = await get(`commits/${encodeURIComponent(latest.tag_name)}`);
  const version = latest.tag_name.slice(1);
  const supported = new Set([
    ...['darwin', 'linux'].flatMap(os => ['amd64', 'arm64'].map(arch => `garage_${version}_${os}_${arch}.tar.gz`)),
    ...['amd64', 'arm64'].map(arch => `garage_${version}_darwin_${arch}.pkg`),
    ...['amd64', 'arm64'].map(arch => `garage_${version}_windows_${arch}.zip`),
    ...['amd64', 'arm64'].map(arch => `garage_${version}_linux_${arch}.deb`),
    ...['x86_64', 'aarch64'].map(arch => `garage-${version}-1.${arch}.rpm`),
    `garage_${version}_checksums.txt`,
    `garage_${version}_checksums.txt.sigstore.json`
  ]);
  const assets = latest.assets.filter(asset => supported.has(asset.name)).map(asset => ({
    name: asset.name,
    url: asset.state === 'uploaded' ? asset.browser_download_url : ''
  })).sort((a, b) => a.name.localeCompare(b.name, 'en'));
  return validateRelease({ version: latest.tag_name, revision: commit.sha, assets });
}

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

export async function frameworkSource(root) {
  const pinned = JSON.parse(readFileSync(resolve(root, 'framework-source.json'), 'utf8'));
  if (!/^[\w.-]+\/[\w.-]+$/.test(pinned.repository) || !/^[a-f0-9]{40}$/.test(pinned.revision) || typeof pinned.version !== 'string' || !pinned.version.trim()) {
    throw new Error('framework-source.json must contain a GitHub repository, a full commit SHA, and a version.');
  }
  const repo = `https://github.com/${pinned.repository}`;
  if (process.env.BUILDER_GARAGE_SOURCE) {
    const source = resolve(process.env.BUILDER_GARAGE_SOURCE);
    const git = (...args) => execFileSync('git', ['-C', source, ...args], { encoding: 'utf8' }).trim();
    const sha = git('rev-parse', 'HEAD');
    if (process.env.BUILDER_GARAGE_REVISION && process.env.BUILDER_GARAGE_REVISION !== sha) {
      throw new Error('BUILDER_GARAGE_REVISION does not match the source checkout.');
    }
    return { source, repo, sha, version: process.env.BUILDER_GARAGE_VERSION || git('describe', '--tags', '--always', '--dirty') };
  }
  if (process.env.BUILDER_GARAGE_REVISION || process.env.BUILDER_GARAGE_VERSION) {
    throw new Error('Update framework-source.json to change the pinned revision or version.');
  }
  const cache = resolve(root, '.cache/framework');
  const source = resolve(cache, pinned.revision);
  if (!existsSync(source)) {
    mkdirSync(cache, { recursive: true });
    const staging = mkdtempSync(resolve(cache, 'download-'));
    try {
      const response = await fetch(`https://codeload.github.com/${pinned.repository}/tar.gz/${pinned.revision}`, {
        signal: AbortSignal.timeout(60000)
      });
      if (!response.ok) throw new Error(`Framework download failed: HTTP ${response.status}`);
      const archive = resolve(staging, 'source.tar.gz');
      writeFileSync(archive, Buffer.from(await response.arrayBuffer()));
      execFileSync('tar', ['-xzf', archive, '--strip-components=1', '-C', staging]);
      rmSync(archive);
      if (!existsSync(resolve(staging, 'README.md'))) throw new Error('Framework archive is missing README.md.');
      renameSync(staging, source);
    } finally {
      if (existsSync(staging)) rmSync(staging, { recursive: true, force: true });
    }
  }
  if (!existsSync(resolve(source, 'README.md'))) throw new Error(`Invalid framework cache: ${source}`);
  return { source, repo, sha: pinned.revision, version: pinned.version };
}

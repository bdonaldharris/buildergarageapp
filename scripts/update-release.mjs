import { writeFileSync } from 'node:fs';
import { fetchLatestRelease } from './release.mjs';

const release = await fetchLatestRelease();
writeFileSync('release.json', JSON.stringify(release, null, 2) + '\n');
console.log(`Selected ${release.version} at ${release.revision}`);

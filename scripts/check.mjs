import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const dist = resolve('dist');
const required = ['index.html', 'library/index.html', 'get-started/index.html', 'rss.xml', 'site.css', 'site.js'];
for (const file of required) if (!existsSync(resolve(dist, file))) throw new Error(`Missing build output: ${file}`);
const library = readFileSync(resolve(dist, 'library/index.html'), 'utf8');
if (!library.includes('aria-live') || !library.includes('Search the library')) throw new Error('Library accessibility controls missing');
if (!readdirSync(resolve(dist, 'library/skills')).length) throw new Error('No generated skill pages');
console.log('Static output checks passed.');

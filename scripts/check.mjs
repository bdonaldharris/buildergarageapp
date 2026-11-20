import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { frameworkSource } from './source.mjs';
import { loadRelease } from './release.mjs';

const dist = resolve('dist');
const vercel = JSON.parse(readFileSync(resolve('vercel.json'), 'utf8'));
assert.ok(vercel.redirects.some(rule => rule.source === '/index.html' && rule.destination === '/' && rule.permanent === true), 'Legacy homepage URL permanently redirects to root');
const { source, repo, sha } = await frameworkSource(resolve('.'));
const required = ['index.html', 'download/index.html', 'privacy/index.html', 'library/index.html', 'get-started/index.html', '404.html', 'rss.xml', 'site.css', 'site.js', 'source.json'];
for (const file of required) if (!existsSync(resolve(dist, file))) throw new Error(`Missing build output: ${file}`);
const library = readFileSync(resolve(dist, 'library/index.html'), 'utf8');
if (!library.includes('aria-live') || !library.includes('Search the library')) throw new Error('Library accessibility controls missing');
const catalog = JSON.parse(readFileSync(resolve(dist, 'source.json'), 'utf8'));
assert.equal(catalog.revision, sha, 'Catalog must identify the selected source');
const decode = value => value.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const pages = new Map();

function collectPages(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) collectPages(path);
    else if (entry.name.endsWith('.html')) pages.set(path, readFileSync(path, 'utf8'));
  }
}
collectPages(dist);
for (const [path, html] of pages) {
  assert.ok(html.includes('<a class="brand" href="/">'), `Brand links to root homepage: ${path}`);
  const githubCTA = html.match(/<a class="github"[^>]*>/)?.[0];
  assert.ok(githubCTA?.includes('target="_blank"') && githubCTA.includes('rel="noopener noreferrer"') && githubCTA.includes('aria-label="GitHub (opens in a new tab)"'), `GitHub CTA opens a safe, announced new tab: ${path}`);
  assert.ok(!/\bclass="[^"]*\beyebrow\b/.test(html), `Page omits eyebrow labels: ${path}`);
  assert.doesNotMatch(html, /\b(?:SignPath|Authenticode|SmartScreen|platform[- ]sign(?:ed|ing))\b|\bWindows code-signing\b/i, `Page omits Windows signing copy: ${path}`);
  const footer = html.match(/<footer>[\s\S]*?<\/footer>/)?.[0];
  assert.ok(footer?.includes('>Source details</a>'), `Footer links to source details: ${path}`);
  assert.match(footer, /<a href="[^"]*privacy\/">Privacy<\/a>/, `Footer links to privacy policy: ${path}`);
  const footerText = footer.replace(/<[^>]*>/g, '');
  assert.ok(!footerText.includes(sha.slice(0, 7)) && !footerText.includes(catalog.version), `Footer omits repeated provenance: ${path}`);
  const base = new URL(path.slice(dist.length), 'https://site.invalid');
  for (const [tag, href] of html.matchAll(/<a\b[^>]*\bhref="([^"]*)"[^>]*>/g)) {
    const url = new URL(decode(href), 'https://buildergarage.app');
    if (['http:', 'https:'].includes(url.protocol) && url.origin !== 'https://buildergarage.app') {
      assert.ok(tag.includes('target="_blank"') && tag.includes('rel="noopener noreferrer"'), `External link opens safely in a new tab in ${path}: ${href}`);
    } else {
      assert.ok(!tag.includes('target="_blank"'), `Internal and non-web links keep their navigation behavior in ${path}: ${href}`);
    }
  }
  for (const [, raw] of html.matchAll(/<(?:a|link|script|img)\b[^>]*\b(?:href|src)="([^"]+)"/g)) {
    const url = new URL(decode(raw), base);
    if (url.origin === base.origin) {
      let target = resolve(dist, '.' + decodeURIComponent(url.pathname));
      if (!existsSync(target)) throw new Error(`Missing local link in ${path}: ${raw}`);
      if (statSync(target).isDirectory()) target = resolve(target, 'index.html');
      if (!existsSync(target)) throw new Error(`Missing local page in ${path}: ${raw}`);
      if (url.hash && pages.has(target)) {
        const id = decodeURIComponent(url.hash.slice(1));
        if (!pages.get(target).includes(`id="${id}"`)) throw new Error(`Missing fragment in ${path}: ${raw}`);
      }
    } else {
      for (const kind of ['blob', 'tree', 'raw']) {
        const prefix = `${repo}/${kind}/${sha}/`;
        if (url.href.startsWith(prefix)) {
          const target = resolve(source, decodeURIComponent(url.pathname.split(`/${sha}/`)[1]));
          if (!existsSync(target)) throw new Error(`Missing pinned source link in ${path}: ${raw}`);
        }
      }
    }
  }
}

const home = readFileSync(resolve(dist, 'index.html'), 'utf8');
assert.match(home, /<span class="status"><i><\/i> Foundation stage<\/span>/);
const homeResources = home.match(/<ul class="resources">[\s\S]*?<\/ul>/)?.[0];
assert.ok(home.includes('<h2>Resources</h2>') && homeResources, 'Homepage has a Resources section');
for (const [type, name] of [['cli', 'CLI'], ['skills', 'Skills'], ['manuals', 'Manuals']]) {
  assert.ok(homeResources.includes(`href="library/?type=${type}"`) && homeResources.includes(`>${name}</span>`), `Homepage links to ${name} category`);
}
assert.equal([...homeResources.matchAll(/class="resource"/g)].length, 3, 'Homepage has exactly three resource categories');
assert.ok(!home.includes('Current source revision'));
assert.ok(!library.includes('Generated from Builder Garage') && !library.includes('Built from'));
const gettingStarted = readFileSync(resolve(dist, 'get-started/index.html'), 'utf8');
assert.ok(!gettingStarted.includes('Verified against'));
const learn = readFileSync(resolve(dist, 'learn/index.html'), 'utf8');
assert.ok(!learn.includes('<small>'), 'Guide listings omit repository paths and redundant labels');
for (const guide of catalog.guides) {
  const html = readFileSync(resolve(dist, '.' + guide.url, 'index.html'), 'utf8');
  const header = html.split('<div class="reading">')[0];
  const visible = header.replace(/<[^>]*>/g, '');
  assert.ok(!visible.includes(guide.path) && !visible.includes(sha.slice(0, 7)), `Guide header omits provenance: ${guide.title}`);
  assert.ok(header.includes(`${repo}/blob/${sha}/${guide.path}`), `Guide keeps pinned source link: ${guide.title}`);
}
const updates = readFileSync(resolve(dist, 'updates/index.html'), 'utf8');
assert.ok(updates.includes(`${catalog.version} · ${sha.slice(0, 7)}`), 'Updates retains snapshot provenance');
const cliDetail = readFileSync(resolve(dist, 'library/cli/garage/index.html'), 'utf8');
for (const [label, html] of [['Home', home], ['Getting Started', gettingStarted], ['CLI detail', cliDetail]]) {
  assert.ok(html.includes('<pre>npm install -g @buildergarage/garage</pre>') && html.includes('Node.js 20 or later'), `Copyable npm install guidance is present on ${label}`);
}
assert.ok(gettingStarted.includes(`git checkout ${sha}`) && cliDetail.includes(`git checkout ${sha}`), 'Source build commands retain the exact revision');
const release = loadRelease();
const releaseUrl = `${repo}/releases/tag/${release.version}`;
for (const page of ['download/index.html', 'learn/build-from-source/index.html']) {
  const html = readFileSync(resolve(dist, page), 'utf8');
  assert.ok(html.includes(`href="${releaseUrl}"`), `Published binaries are discoverable: ${page}`);
  assert.ok(!/no release is published yet|none is published yet|first published release will be|not a published binary release|published binary releases and installation packages do not|release automation are not available yet/i.test(html), `Release availability is current: ${page}`);
}
for (const html of [gettingStarted, updates, readFileSync(resolve(dist, 'library/cli/garage/index.html'), 'utf8'), readFileSync(resolve(dist, 'download/index.html'), 'utf8')]) {
  assert.ok(html.includes('Gatekeeper'), 'Binary guidance discloses macOS trust limitations');
  assert.ok(html.includes('docs/release-verification.md'), 'Binary guidance links to verification instructions');
}
const download = readFileSync(resolve(dist, 'download/index.html'), 'utf8');
assert.ok(download.includes('<fieldset class="os-selector" hidden>') && !download.includes('id="download-os"'), 'OS choices are enhanced without hiding downloads when JavaScript is unavailable');
for (const os of ['windows', 'macos', 'linux']) {
  const platform = download.match(new RegExp(`<section class="download-platform" data-platform="${os}">([\\s\\S]*?)</section>`))?.[1];
  assert.ok(platform, `Download options are grouped for ${os}`);
  assert.equal(platform.includes('npm install -g @buildergarage/garage'), os !== 'windows', `npm install guidance matches supported platforms: ${os}`);
}
for (const asset of release.assets) assert.ok(download.includes(`href="${asset.url}"`), `Download page links to ${asset.name}`);
assert.ok(download.includes(`${repo}/commit/${release.revision}`) && download.includes(`${repo}/commit/${sha}`), 'Release and source provenance are shown');

const fontStylesheet = resolve(dist, 'assets/fonts/fonts.css');
const fonts = readFileSync(fontStylesheet, 'utf8');
for (const [, file] of fonts.matchAll(/url\(['"]?([^'")]+)['"]?\)/g)) {
  const font = readFileSync(new URL(file, `file://${fontStylesheet}`));
  if (font.subarray(0, 4).toString() !== 'wOF2') throw new Error(`Invalid WOFF2 font: ${file}`);
}

const sourceSkills = readdirSync(resolve(source, 'skills')).filter(name => existsSync(resolve(source, 'skills', name, 'SKILL.md')));
const sourceManuals = readdirSync(resolve(source, 'manuals')).filter(name => name.endsWith('.md') && name !== 'README.md');
assert.equal(catalog.artifacts.filter(a => a.type === 'skills').length, sourceSkills.length);
assert.equal(catalog.artifacts.filter(a => a.type === 'manuals').length, sourceManuals.length);
for (const artifact of catalog.artifacts) {
  assert.ok(existsSync(resolve(source, artifact.path)), `Artifact source exists: ${artifact.path}`);
  assert.ok(library.includes(`href="${artifact.url}"`), `Artifact is listed: ${artifact.name}`);
  const detail = readFileSync(resolve(dist, '.' + artifact.url, 'index.html'), 'utf8');
  const technical = detail.match(/<details class="technical-details">[\s\S]*?<\/details>/)?.[0];
  assert.ok(technical?.includes('<dt>Source revision</dt>'), `Revision is collapsed by default: ${artifact.name}`);
  assert.ok(!detail.includes('<dt>Type</dt>'), `Artifact omits redundant type description: ${artifact.name}`);
  const primary = detail.replace(technical, '');
  if (artifact.type === 'skills') {
    assert.ok(technical.includes('<dt>Files</dt>') && !primary.includes('<dt>Files</dt>'), `File inventory is collapsed: ${artifact.name}`);
    assert.ok(primary.includes(`<dt>Technician role</dt><dd>${artifact.role}</dd>`), `Role stays visible: ${artifact.name}`);
  } else {
    assert.ok(primary.includes(artifact.type === 'manuals' ? `<dt>Status</dt><dd>${artifact.role}</dd>` : '<dt>Requirement</dt>'), `Usage metadata stays visible: ${artifact.name}`);
  }
  assert.ok(detail.includes(artifact.sourceUrl), `Artifact links to its pinned source: ${artifact.name}`);
  if (artifact.type === 'skills') {
    const sourceFile = readFileSync(resolve(source, artifact.path), 'utf8');
    const role = sourceFile.match(/^\s+garage-role:\s*(\S+)/m)?.[1];
    assert.equal(artifact.role, role, `Role comes from source metadata: ${artifact.name}`);
    const directory = resolve(source, 'skills', artifact.name);
    for (const file of readdirSync(directory, { recursive: true })) {
      if (!statSync(resolve(directory, file)).isFile()) continue;
      const actual = execFileSync('unzip', ['-p', resolve(dist, 'downloads', `${artifact.name}.zip`), `${artifact.name}/${file}`]);
      assert.deepEqual(actual, readFileSync(resolve(directory, file)), `Download preserves ${artifact.name}/${file}`);
    }
  } else if (artifact.type === 'manuals') {
    assert.deepEqual(readFileSync(resolve(dist, 'downloads', `${artifact.name}.md`)), readFileSync(resolve(source, artifact.path)));
  }
}
console.log(`Checked ${pages.size} pages and ${catalog.artifacts.length} artifacts against ${sha.slice(0, 7)}.`);

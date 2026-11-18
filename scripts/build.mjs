import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { basename, dirname, resolve } from 'node:path';
import { frameworkSource } from './source.mjs';
import { renderMarkdown } from './markdown.mjs';
import { openExternalLinks } from './links.mjs';
import { loadRelease } from './release.mjs';

const root = resolve('.');
const { source, repo, sha, version } = await frameworkSource(root);
const out = resolve(root, 'dist');
if (!existsSync(resolve(source, 'README.md'))) throw new Error(`Builder Garage source not found: ${source}. Set BUILDER_GARAGE_SOURCE.`);
rmSync(out, { recursive: true, force: true }); mkdirSync(out, { recursive: true });
const shortSha = sha.slice(0, 7);
const release = loadRelease(resolve(root, 'release.json'));
const releaseVersion = release.version;
const releaseUrl = `${repo}/releases/tag/${releaseVersion}`;
const releaseVerification = `${repo}/blob/${releaseVersion}/docs/release-verification.md`;
const releaseInfo = `<p><a href="/download/">Download garage ${releaseVersion}</a> for macOS, Linux, or Windows on amd64 and arm64. Prebuilt executables do not require Go.</p>
  <p>Verify the signed checksum manifest and your archive's checksum before running it; GitHub artifact attestations are also available. Follow <a href="${releaseVerification}">release verification and terminal extraction instructions ↗</a>.</p>
  <p class="callout">Check the <a href="${releaseUrl}">release notes</a> for current platform signing status. Gatekeeper or SmartScreen warnings may appear. Integrity and provenance verification do not replace operating-system publisher trust.</p>`;
const text = p => readFileSync(resolve(source, p), 'utf8');
const goVersion = text('go.mod').match(/^go (\S+)$/m)?.[1];
if (!goVersion) throw new Error('Framework go.mod is missing its Go version.');
const sourceInstall = `git clone ${repo}.git\ncd builder-garage\ngit checkout ${sha}\n./install.sh\ngarage version`;
const installRequirements = `Requires Go ${goVersion} to build. The source installer supports macOS and Linux and installs to ~/.local/bin without changing PATH. On Windows, build by hand.`;
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const summary = s => s.replace(/^Shorthand:\s*[^.]+\.\s*/i, '').split(/(?<=[.!?])\s/)[0].replace(/\s+/g, ' ').trim();
function frontmatter(value) { const m = value.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/); if (!m) return [{}, value]; const data = {}; for (const line of m[1].split('\n')) { const kv = line.match(/^\s*([\w.-]+):\s*(.*)$/); if (kv) data[kv[1]] = kv[2].replace(/^['"]|['"]$/g, ''); } return [data, m[2]]; }
const skills = readdirSync(resolve(source, 'skills'), { withFileTypes: true }).filter(x => x.isDirectory() && existsSync(resolve(source, 'skills', x.name, 'SKILL.md'))).map(dir => {
  const path = `skills/${dir.name}/SKILL.md`, [meta] = frontmatter(text(path)); const description = meta.description || '';
  const alias = description.match(/^Shorthand:\s*([\w-]+)/i)?.[1] || '—';
  const role = meta['garage-role'];
  if (!role) throw new Error(`Missing metadata.garage-role in ${path}`);
  return { type: 'skills', name: meta.name || dir.name, path, alias, role, description, summary: summary(description), files: readdirSync(resolve(source, 'skills', dir.name), { recursive: true }).filter(x => typeof x === 'string'), url: `/library/skills/${dir.name}/`, sourceUrl: `${repo}/blob/${sha}/${path}` };
});
const manuals = existsSync(resolve(source, 'manuals')) ? readdirSync(resolve(source, 'manuals')).filter(name => name.endsWith('.md') && name !== 'README.md').map(file => {
  const path = `manuals/${file}`, [meta] = frontmatter(text(path)); const name = meta.name || basename(file, '.md');
  return { type: 'manuals', name, alias: `manual v${meta.version || '0.1'}`, role: meta.status || 'provisional', summary: meta.description || `${name} engineering manual.`, description: meta.description || `${name} engineering manual.`, path, url: `/library/manuals/${name}/`, sourceUrl: `${repo}/blob/${sha}/${path}`, manual: true };
}) : [];
const cli = { type: 'cli', name: 'garage', alias: 'CLI', role: 'foundation', summary: 'A CLI for project configuration, private local workflow records, skill and adopted-manual installation, and read-only GitHub workflow status. Available as a prebuilt binary or source build.', description: 'The CLI initializes and upgrades project configuration; validates, shows, and changes settings; records private local workflow events; installs and verifies canonical skills and adopted manuals; reads issue or pull-request workflow status through gh; and reports its version. It does not execute workflows, configure agents, connect AI providers, load plugins, or provide remote services.', path: 'cmd/garage/main.go', url: '/library/cli/garage/', sourceUrl: `${repo}/blob/${sha}/cmd/garage/main.go` };
const artifacts = [cli, ...skills, ...manuals];
const artifactLabel = a => ({ skills: 'Skill', manuals: 'Manual', cli: 'CLI' })[a.type];
const roles = [...new Set(skills.map(a => a.role))];
const guideFiles = [
  ['build-from-source', 'Install and build from source', 'README.md'],
  ['configuration', 'Project configuration', 'docs/configuration.md'],
  ['skill-installation', 'Install and verify skills', 'docs/skill-installation.md'],
  ['manuals', 'Adopt technology manuals', 'manuals/README.md'],
  ['principles', 'Engineering principles', 'docs/principles.md'],
  ['review-evidence', 'Revision-identifiable review evidence', 'docs/review-evidence.md'],
  ['gate-map', 'From issue to merge', 'inspection/gate-map.md'],
  ['filling-roles', 'Filling Crew roles', 'crew/filling-roles.md'],
  ['history', 'Project history', 'docs/history.md'],
  ['first-contribution', 'Your first contribution', 'docs/first-contribution.md']
];
for (const [, , path] of guideFiles) if (!existsSync(resolve(source, path))) throw new Error(`Missing source guide: ${path}`);
function copy(from, to) { mkdirSync(dirname(to), { recursive: true }); cpSync(from, to, { recursive: true }); }
copy(resolve(root, 'assets'), resolve(out, 'assets'));
copy(resolve(root, 'site.css'), resolve(out, 'site.css'));
copy(resolve(root, 'site.js'), resolve(out, 'site.js'));
for (const skill of skills) { const target = resolve(out, 'downloads', `${skill.name}.zip`); mkdirSync(dirname(target), { recursive: true }); execFileSync('zip', ['-qr', target, skill.name], { cwd: resolve(source, 'skills') }); }
for (const manual of manuals) copy(resolve(source, manual.path), resolve(out, 'downloads', `${manual.name}.md`));
function nav(current, depth = '') { const links = [['How it works','how-it-works/'],['Get Started','get-started/'],['Library','library/'],['Learn','learn/'],['Updates','updates/']]; return `<a class="skip" href="#main">Skip to content</a><header><a class="brand" href="/"><img src="${depth}assets/logo.png" alt="Builder Garage"></a><button class="menu" aria-label="Open navigation" aria-controls="site-nav" aria-expanded="false">Menu</button><nav id="site-nav" aria-label="Primary">${links.map(([l,u])=>`<a ${current===u?'aria-current="page"':''} href="${depth}${u}">${l}</a>`).join('')}<a class="github" href="${repo}" target="_blank" rel="noopener noreferrer" aria-label="GitHub (opens in a new tab)">GitHub ↗</a></nav></header>`; }
function footer(depth='') { return `<footer><img src="${depth}assets/logo.png" alt="Builder Garage"><p><a href="${repo}/blob/${sha}/LICENSE">MIT License</a> · © 2026 B Donald Harris<br><a href="${depth}updates/">Source details</a></p><nav aria-label="Footer"><a href="${repo}">GitHub</a><a href="${depth}contribute/">Contribute</a><a href="${depth}privacy/">Privacy</a><a href="${repo}/blob/${sha}/CODE_OF_CONDUCT.md">Code of Conduct</a><a href="${repo}/blob/${sha}/SECURITY.md">Security</a><a href="${depth}rss.xml">RSS</a></nav></footer>`; }
function layout({ title, description, current='', depth='', body }) { return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="${esc(description)}"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:image" content="${depth}assets/workshop.png"><title>${esc(title)} · Builder Garage</title><link rel="preload" href="${depth}assets/fonts/archivo-latin-700-normal.woff2" as="font" type="font/woff2" crossorigin><link rel="preload" href="${depth}assets/fonts/inter-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin><link rel="stylesheet" href="${depth}assets/fonts/fonts.css"><link rel="stylesheet" href="${depth}site.css"></head><body>${nav(current,depth)}<main id="main">${body}</main>${footer(depth)}<script src="${depth}site.js"></script></body></html>`; }
const status = `<span class="status"><i></i> Foundation stage</span>`;
const code = (value, title='') => `<div class="code">${title?`<b>${esc(title)}</b>`:''}<button class="copy" aria-label="Copy commands">Copy</button><pre>${esc(value)}</pre><span class="copy-live" aria-live="polite"></span></div>`;
const pageHead = (title,lead,aside='') => `<section class="page-head"><div><h1>${title}</h1><p>${lead}</p></div>${aside}</section>`;
function write(path, html) { const file = resolve(out, path, 'index.html'); mkdirSync(dirname(file), {recursive:true}); writeFileSync(file, openExternalLinks(html)); }
const card = a => `<article class="resource"><div><span class="tag">${a.type === 'skills' ? 'SKILL' : a.type === 'manuals' ? 'MANUAL' : 'CLI'}</span>${a.role!=='foundation'?` <span class="tag blue">${esc(a.role)}</span>`:''}</div><h3><a href="${a.url}">${esc(a.name)}</a></h3><p>${esc(a.summary)}</p><a href="${a.url}">View details →</a></article>`;
const workflow = `<ol class="workflow"><li><b>01</b><h3>Discover</h3><p>Understand the system before changing it.</p></li><li><b>02</b><h3>Assess readiness</h3><p>Resolve material uncertainty deliberately.</p></li><li><b>03</b><h3>Implement</h3><p>Keep work scoped to the evidence.</p></li><li class="inspection"><b>04</b><h3>Inspect</h3><p>Independent review tests the real artifact.</p></li><li><b>05</b><h3>Ship</h3><p>Human authority remains with the maintainer.</p></li></ol>`;
write('', layout({
  title: 'Build with AI agents. Keep the engineering.',
  description: 'Builder Garage is a project-embedded engineering framework for responsible construction with AI agents.',
  body: `
    <section class="hero" aria-labelledby="hero-title">
      <div class="container hero-brand">
        <img class="hero-logo" src="assets/logo.png" alt="Builder Garage" width="2172" height="724" fetchpriority="high">
      </div>
      <div class="container hero-grid">
        <div class="hero-copy">
          ${status}
          <h1 id="hero-title">Build with AI agents.<br><span>Keep the engineering.</span></h1>
          <p class="hero-lead">Skills, roles, and evidence-based workflows for responsible software construction. Built into your project, with you in control.</p>
          <p class="actions">
            <a class="button" href="get-started/">Get started</a>
            <a class="button secondary" href="library/">Browse the Library</a>
          </p>
        </div>
        <div class="hero-install">
          <div class="terminal-bar"><span class="terminal-lights" aria-hidden="true"><i></i><i></i><i></i></span><span>garage / quick start</span></div>
          ${code(sourceInstall, 'Install from source / macOS + Linux')}
          <p class="install-note">Prefer a prebuilt CLI? <a href="download/">Download ${releaseVersion} for macOS, Linux, or Windows →</a>.<br>Source builds require Go ${esc(goVersion)}. No hosted runtime.<br><a href="get-started/#framework">Read setup and release verification guidance →</a></p>
        </div>
      </div>
    </section>
    <section class="workflow-section section" aria-labelledby="workflow-title">
      <div class="container">
        <h2 id="workflow-title">Engineering stays in the loop.</h2>
        ${workflow}
      </div>
    </section>
    <section class="dark section shop-section">
      <div class="container">
        <h2>Responsibilities, not products.</h2>
        <div class="shop">
          <article><h3>Workbench</h3><p>Reusable skills and procedures.</p><small>Available · ${skills.length} skills</small></article>
          <article><h3>Crew</h3><p>Explicit agent responsibilities and handoffs.</p><small>Documented</small></article>
          <article><h3>Inspection</h3><p>Independent review and quality gates.</p><small>Documented</small></article>
          <article><h3>Shipping</h3><p>Integration and promotion readiness.</p><small>Documented</small></article>
          <article><h3>Manuals</h3><p>Technology-specific engineering guidance.</p><small>Available · ${manuals.length} manuals</small></article>
        </div>
      </div>
    </section>
    <section class="paths home-paths">
      <div class="container">
        <h2>Start where you need to.</h2>
        <div class="path-grid">
          <article><h3>Bring the whole toolkit.</h3><p>Download the CLI or build it from source, initialize a project, and adopt the practices deliberately.</p><a href="get-started/#framework">Use the framework →</a></article>
          <article><h3>Pick the part you need.</h3><p>Browse reusable engineering skills directly. Each download preserves the source structure.</p><a href="get-started/#artifacts">Use individual artifacts →</a></article>
        </div>
      </div>
    </section>
    <section class="tray section">
      <div class="container">
        <h2>Parts you can inspect.</h2>
        <div class="resources">${artifacts.slice(0,5).map(card).join('')}</div>
        <a class="button secondary ink" href="library/">View all resources</a>
      </div>
    </section>
    <section class="dark section">
      <div class="container split">
        <div><h2>Guides from the workshop.</h2><p>Source-backed guides cover installation, project configuration, skills, manuals, review evidence, and your first contribution.</p><a href="learn/">Explore Learn →</a></div>
        <div class="log"><h3>Shop log</h3><a href="updates/">Project updates →</a><a href="${repo}/tree/${sha}/docs">Engineering decisions and history</a><a href="contribute/">Help shape the framework →</a></div>
      </div>
    </section>`
}));

function libraryPage(selected = null, detailOnly = false) {
  const depth = detailOnly ? '../../../' : '../';
  const selectedArtifact = selected || cli;
  const list = `<div class="library-list">${artifacts.map(a => `
    <a class="resource-row ${a.name === selectedArtifact.name ? 'selected' : ''}" data-type="${a.type}" data-role="${esc(a.type === 'skills' ? a.role : '')}" href="${a.url}">
      <span aria-hidden="true">${a.type === 'cli' ? '⌘' : '▣'}</span><strong>${esc(a.name)}</strong>
      <small>${esc(a.alias)} · ${esc(a.summary)}</small><em>${artifactLabel(a)}</em>
    </a>`).join('')}</div>`;
  const detail = artifactDetail(selectedArtifact, depth);
  const body = detailOnly
    ? `<section class="detail-page"><a class="back" href="${depth}library/">← Back to Library</a>${detail}</section>`
    : `${pageHead('The parts bin', 'Find skills, technology manuals, and the CLI for your engineering workflow.', `<label class="search"><span class="sr">Search the library</span><input id="library-search" type="search" placeholder="Search the library"></label>`)}
      <section class="toolbar"><div class="tabs" aria-label="Artifact types">
        <button data-type="all" class="active">All <small>${artifacts.length}</small></button>
        ${['cli', 'skills', 'manuals'].map(type => `<button data-type="${type}">${({cli: 'CLI', skills: 'Skills', manuals: 'Manuals'})[type]} <small>${artifacts.filter(a => a.type === type).length}</small></button>`).join('')}
      </div><button class="filter-toggle" aria-expanded="false">Filters</button></section>
      <section class="library">
        <aside class="filters"><fieldset><legend>Technician role</legend>${roles.map(role => `<label><input type="checkbox" name="role" value="${esc(role)}"> ${esc(role)}</label>`).join('')}</fieldset></aside>
        <div><p id="result-count" aria-live="polite">${artifacts.length} parts</p>${list}<p class="empty" hidden>No parts match. <button class="clear">Clear filters</button></p></div>
        <aside class="detail-panel">${detail}</aside>
      </section>`;
  return layout({ title: detailOnly ? selectedArtifact.name : 'Library', description: 'Builder Garage artifacts generated from the pinned framework source.', current: 'library/', depth, body });
}

function artifactDetail(a, depth = '') {
  const isSkill = a.type === 'skills', isManual = a.type === 'manuals';
  const download = isSkill ? `${depth}downloads/${a.name}.zip` : isManual ? `${depth}downloads/${a.name}.md` : null;
  let instructions;
  if (isSkill) {
    instructions = `<div class="install-tabs">
      <div role="tablist" aria-label="Install options"><button role="tab" aria-selected="true" aria-controls="copy-panel">Copy this skill</button><button role="tab" aria-selected="false" aria-controls="cli-panel">With the garage CLI</button></div>
      <section id="copy-panel" role="tabpanel">
        <p>Download the ZIP below, preserve the <code>${esc(a.name)}/</code> directory, and place it in a skill directory supported by your harness.</p>
        <p class="callout">Hand-placed skills are unmanaged. Canonical skills resolve project choices through <code>garage config validate</code>, so configuration-dependent steps still need a valid project configuration and <code>garage</code> on PATH. Directly requested discovery does not require configuration for its discovery-applicability decision.</p>
      </section>
      <section id="cli-panel" role="tabpanel" hidden>
        <p>From a project with valid configuration and declared skill targets, install and verify the complete embedded canonical skill set, together with the manuals the project adopts:</p>
        ${code('garage config validate\ngarage skills install\ngarage skills verify')}
        <p>The CLI supports user-scope targets for Claude Code, Codex, and Copilot CLI, not individual-skill or project-scope installs. Harness path behavior was confirmed on macOS; Linux and Windows harness behavior remains unconfirmed. Existing unmanaged or modified copies require explicit replacement consent and a backup. See <a href="${depth}learn/skill-installation/">skill installation</a>.</p>
      </section>
    </div>`;
  } else if (isManual) {
    instructions = `<h2>Adopt and deliver this manual</h2>
      <p>From an initialized project, adopt the manual explicitly, then deliver it at the project's declared user-scope skill targets:</p>
      ${code(`garage config add manual ${a.name}\ngarage skills install\ngarage skills verify`)}
      <p>The CLI delivers <code>builder-garage-manual-${esc(a.name)}</code> as a skill. Installation alone does not make the guidance apply: the project's configuration must adopt it. Manuals are guidance, not workflow requirements or configuration files. See <a href="${depth}learn/manuals/">how manuals are used</a>.</p>`;
  } else {
    instructions = `<h2>Download a prebuilt CLI</h2>${releaseInfo}
      <h2>Or build from source</h2>${code(sourceInstall, 'macOS and Linux')}
      <p>${esc(installRequirements)} Compiled executables do not require Go at run time.</p>
      <p>A plain <code>go build ./cmd/garage</code> reports <code>dev</code>; the source installer derives its version from Git.</p>
      <p><a href="${depth}learn/build-from-source/#build-by-hand">Build by hand, including on Windows →</a></p>`;
  }
  return `<article class="artifact">
    <div class="artifact-title"><span class="tag">${artifactLabel(a).toUpperCase()}</span><h1 tabindex="-1">${esc(a.name)}</h1><p>${esc(a.alias)}</p></div>
    <div class="artifact-body"><p class="lead">${esc(a.description)}</p>
      <dl>${isSkill ? `<dt>Technician role</dt><dd>${esc(a.role)}</dd>` : isManual ? `<dt>Status</dt><dd>${esc(a.role)}</dd>` : `<dt>Requirement</dt><dd>Go ${esc(goVersion)} to build from source</dd>`}</dl>
      <details class="technical-details"><summary>Technical details</summary>
        <dl><dt>Source revision</dt><dd><a href="${repo}/commit/${sha}">${esc(version)} · ${shortSha}</a></dd>${isSkill ? `<dt>Files</dt><dd>${a.files.map(esc).join(', ')}</dd>` : ''}
        </dl>
      </details>${instructions}
      <p class="actions">${download ? `<a class="button" href="${download}" download>Download ${isManual ? 'Markdown' : '.zip'}</a>` : ''}<a class="button secondary ink" href="${a.sourceUrl}">View on GitHub ↗</a></p>
    </div>
  </article>`;
}
write('library', libraryPage()); for (const a of artifacts) write(`library/${a.type}/${a.name}`, libraryPage(a, true));

const releaseAsset = name => release.assets.find(asset => asset.name === name);
const releaseNumber = releaseVersion.slice(1);
function downloadLink(name, label) {
  const asset = releaseAsset(name);
  return asset ? `<a class="button secondary ink" href="${esc(asset.url)}">${esc(label)}</a>` : '';
}
write('download', layout({
  title: 'Download the CLI', description: 'Download the Builder Garage CLI for your operating system.', depth: '../',
  body: `${pageHead('Download the CLI.', `Choose an operating system and architecture for garage ${esc(releaseVersion)}.`)}
    <section class="content download-page">
      <p>Prebuilt executables run without Go. Downloads come from the <a href="${releaseUrl}">${esc(releaseVersion)} GitHub release</a>.</p>
      <label for="download-os">Operating system</label>
      <select id="download-os"><option value="all">All operating systems</option><option value="windows">Windows</option><option value="macos">macOS</option><option value="linux">Linux</option></select>
      <p>Choose your processor architecture; if unsure, check your system settings. Select a different operating system if downloading for another computer.</p>
      <section class="download-platform" data-platform="windows"><h2>Windows</h2>
        <div class="download-links">${downloadLink(`garage_${releaseNumber}_windows_amd64.zip`, 'Windows · x64 (.zip)')}${downloadLink(`garage_${releaseNumber}_windows_arm64.zip`, 'Windows · ARM64 (.zip)')}</div>
        <p>Windows code-signing acknowledgment: <a href="https://signpath.io/">SignPath.io</a> and <a href="https://signpath.org/">SignPath Foundation</a>. Consult the <a href="${releaseUrl}">release notes</a> to confirm whether this release is signed; unsigned binaries may trigger SmartScreen warnings.</p>
      </section>
      <section class="download-platform" data-platform="macos"><h2>macOS</h2>
        <div class="download-links">${downloadLink(`garage_${releaseNumber}_darwin_arm64.tar.gz`, 'macOS · Apple silicon (.tar.gz)')}${downloadLink(`garage_${releaseNumber}_darwin_amd64.tar.gz`, 'macOS · Intel (.tar.gz)')}</div>
        <p>Consult the <a href="${releaseUrl}">release notes</a> for signing and notarization status. Gatekeeper restrictions may apply.</p>
      </section>
      <section class="download-platform" data-platform="linux"><h2>Linux</h2>
        <div class="download-links">${downloadLink(`garage_${releaseNumber}_linux_amd64.tar.gz`, 'Linux · x64 (.tar.gz)')}${downloadLink(`garage_${releaseNumber}_linux_arm64.tar.gz`, 'Linux · ARM64 (.tar.gz)')}${downloadLink(`garage_${releaseNumber}_linux_amd64.deb`, 'Linux · x64 (.deb)')}${downloadLink(`garage_${releaseNumber}_linux_arm64.deb`, 'Linux · ARM64 (.deb)')}${downloadLink(`garage-${releaseNumber}-1.x86_64.rpm`, 'Linux · x64 (.rpm)')}${downloadLink(`garage-${releaseNumber}-1.aarch64.rpm`, 'Linux · ARM64 (.rpm)')}</div>
      </section>
      <h2>Verify before running</h2>
      <p>Verify the signed checksum manifest and your archive or package checksum before running or installing. Artifact attestations are also available. Verification establishes integrity and origin, not operating-system publisher trust. Follow the <a href="${releaseVerification}">release verification instructions</a>.</p>
      <p><a href="${esc(releaseAsset(`garage_${releaseNumber}_checksums.txt`).url)}">Checksum manifest ↗</a> · <a href="${esc(releaseAsset(`garage_${releaseNumber}_checksums.txt.sigstore.json`).url)}">Signature bundle ↗</a></p>
      <p>The CLI release is ${esc(releaseVersion)} (<a href="${repo}/commit/${release.revision}">${release.revision.slice(0, 7)}</a>); the site's Library and guides use the separately pinned ${esc(version)} source snapshot (<a href="${repo}/commit/${sha}">${shortSha}</a>). They may contain different revisions.</p>
      <p><a href="../get-started/#framework">Continue to project setup and source builds →</a></p>
    </section>`
}));
const harness = `<table><thead><tr><th>Harness</th><th>CLI-managed user directory</th></tr></thead><tbody>
  <tr><th>Claude Code</th><td><code>~/.claude/skills</code></td></tr>
  <tr><th>Codex</th><td><code>~/.codex/skills</code></td></tr>
  <tr><th>Copilot CLI</th><td><code>~/.copilot/skills</code></td></tr>
</tbody></table>`;
write('get-started', layout({
  title: 'Get started', description: 'Choose a Builder Garage adoption path.', current: 'get-started/', depth: '../',
  body: `${pageHead('Two ways into the Garage.', 'Adopt the framework or hand-place individual artifacts. Both paths use the canonical skill contracts and configuration rules.')}
    <section class="content">
      <div class="path-grid">
        <article id="framework"><span class="tag">PATH A</span><h2>Use the framework</h2>
          <h3>Download a prebuilt CLI</h3>${releaseInfo}
          <h3>Or build from source</h3><p>Install the CLI from the verified source revision:</p>${code(sourceInstall, 'macOS and Linux')}
          <p>${esc(installRequirements)} If <code>~/.local/bin</code> is not on PATH, follow the installer's instructions before continuing.</p>
          <p><a href="../learn/build-from-source/#build-by-hand">Windows and manual builds →</a></p>
          <h3>Configure your project</h3>
          <p>Run these from your project's root. In a terminal, <code>garage init</code> guides you through human authorities, policies, manuals, and skill targets, then asks for confirmation.</p>
          ${code('garage init\ngarage config validate\ngarage skills install\ngarage skills verify', 'from your project root')}
          <p class="callout">Declare at least one supported user-scope skill target before installing. Downloading or building the CLI does not install skills; <code>garage skills install</code> separately installs the complete embedded canonical skill set and adopted manuals. It never invokes an agent or advances a workflow.</p>
        </article>
        <article id="artifacts"><span class="tag">PATH B</span><h2>Use individual artifacts</h2>
          <p>Download a skill ZIP or manual Markdown file from the Library. Preserve each skill's directory structure and follow your harness's skill-location rules.</p>
          ${harness}
          <p>These are the CLI's default user-scope paths. It also honors <code>CLAUDE_CONFIG_DIR</code>, <code>CODEX_HOME</code>, and <code>COPILOT_HOME</code>. Project-scope installs are not supported by the CLI. Harness path behavior was confirmed on macOS; Linux and Windows harness behavior remains unconfirmed.</p>
          <p><a class="button" href="../library/">Browse the Library</a></p>
          <p class="callout">Hand-placed skills are unmanaged, not standalone executables. Canonical skills use <code>garage config validate</code> when resolving project choices, so those steps still require the CLI on PATH and valid configuration. Manuals apply only when the project adopts them. Read <a href="../learn/configuration/#how-the-skills-read-the-configuration">the configuration contract</a> before use.</p>
        </article>
      </div>
      <h2 id="what-exists-today">What exists today</h2>
      <div class="comparison">
        <p><b>Available:</b> <a href="../download/">prebuilt CLI archives for macOS, Linux, and Windows</a> on amd64 and arm64; source builds; ${skills.length} reusable engineering skills; ${manuals.length} technology manuals (${[...new Set(manuals.map(a => a.role))].map(esc).join(', ')}); the operating model, review contract, governance, and contribution guides.</p>
        <p><b>The CLI:</b> initializes and upgrades project configuration; validates, shows, and changes settings; records private local workflow events; installs and verifies canonical skills and adopted manuals; reads issue and pull-request workflow status through authenticated <code>gh</code>; and reports its version.</p>
        <p><b>Not implemented:</b> workflow execution or agent orchestration, agent configuration, AI-provider connections, plugin loading, remote services, libraries, adapters, or SDKs.</p>
      </div>
    </section>`
}));
write('how-it-works', layout({
  title: 'How Builder Garage works', description: 'The Builder Garage architecture and operating model.', current: 'how-it-works/', depth: '../',
  body: `${pageHead('A workflow with boundaries.', 'Builder Garage defines responsibilities, evidence, and handoffs. The CLI supports the work; it does not orchestrate it.')}
    <section class="dark section"><div class="container">${workflow}</div></section>
    <section class="content">
      <p>The five-step flow is an overview, not a mandatory checklist. Discovery applicability is configured by the project; a separate readiness pass depends on the change's uncertainty and complexity.</p>
      <h2>Five conceptual shop areas</h2>
      <p>Workbench holds procedures; Crew defines who acts; Inspection defines independent verification; Shipping covers integration and promotion; Manuals provide technology guidance. These are responsibilities, not five implemented runtime products.</p>
      <h2>Roles and workflow positions</h2>
      <p>The Technician roles are discovery, readiness, planner, implementer, and reviewer. Human authorities make workflow, change-acceptance, and product-intent decisions. Agent #1 and Agent #2 are workflow positions, not interchangeable personas.</p>
      <div class="path-grid">
        <article><h3>Agent #1 — Implementation</h3><p>The implementer owns scoped implementation, correction, validation, and integration-PR finalization. It stops at an independent-review handoff.</p></article>
        <article><h3>Agent #2 — Independent review</h3><p>A separately invoked reviewer inspects the complete artifact and records its disposition on the governing issue or PR. It never implements or corrects that artifact.</p></article>
      </div>
      <p><a href="../learn/filling-roles/">How people and agents fill the roles →</a></p>
      <h2>The review contract</h2>
      <ol><li>Were the issue's acceptance criteria met?</li><li>Did the implementation introduce a new bug or regression?</li><li>Does the implemented behavior work?</li></ol>
      <p><code>Yes → No → Yes</code> means independent approval, not authorization to merge. The originating issue's implementation review remains authoritative; a supplemental PR review is required only when a trigger applies. Automated reviewers are optional input, never a substitute for Agent #2.</p>
      <p>Required checks, deployment-requirement visibility, configured release conditions, human change acceptance, and product-intent acceptance still govern merge. Where practical, user-facing changes are inspected by the human product-intent acceptor.</p>
      <p><a href="../learn/gate-map/">See the complete gate map →</a></p>
      <h2>Current CLI capabilities</h2><p>${esc(cli.description)}</p>
      <p>Local workflow history is a private annotation, not review evidence. GitHub issue and PR records are authoritative. <code>garage status</code> reads GitHub once through authenticated <code>gh</code>; it never polls, assigns agents, or advances work.</p>
    </section>`
}));
write('learn', layout({
  title: 'Learn', description: 'Builder Garage educational guides from the repository.', current: 'learn/', depth: '../',
  body: `${pageHead('Learn in the open.', 'Guides to setup, engineering practice, and contribution.')}
    <section class="content"><div class="tracks">
      <article><h2>Build and adopt</h2>${guideFiles.slice(0, 4).map(([s,t]) => `<a href="${s}/"><b>${esc(t)}</b></a>`).join('')}</article>
      <article><h2>Practice and contribute</h2>${guideFiles.slice(4).map(([s,t]) => `<a href="${s}/"><b>${esc(t)}</b></a>`).join('')}</article>
    </div></section>`
}));
for (const [guideSlug, guideTitle, guidePath] of guideFiles) {
  let markdown = text(guidePath);
  if (guidePath === 'README.md') {
    markdown = markdown
      .replace('; no release is published yet.', `; [${releaseVersion}](${releaseUrl}) is now published.`)
      .replace('and the first published release will be `v0.1.1` ([ADR 0003](docs/adr/0003-release-distribution.md)); none is published yet.', `and [v0.1.1](${repo}/releases/tag/v0.1.1) was the first published release ([ADR 0003](docs/adr/0003-release-distribution.md)).`)
      .replace(/^- No release is published yet\..*$/m, `- [${releaseVersion}](${releaseUrl}) provides prebuilt CLI archives for macOS, Linux, and Windows on amd64 and arm64. Verify the signed checksum manifest and archive checksum before running a binary; see [Verifying a release](${releaseVerification}). Source installation with [\`install.sh\`](#install-from-source) remains available on macOS and Linux.`);
  }
  const body = renderMarkdown(markdown, { source, repo, sha, path: guidePath });
  write(`learn/${guideSlug}`, layout({
    title: guideTitle, description: `Builder Garage guide: ${guideTitle}.`, current: 'learn/', depth: '../../',
    body: `<article class="article"><a class="back" href="../">← Learn</a><h1>${esc(guideTitle)}</h1><p><a href="${repo}/blob/${sha}/${guidePath}">View source ↗</a></p>${guidePath === 'README.md' ? `<p class="callout">This guide reflects the ${esc(version)} source snapshot, which predates its release. For current downloads and signing status, see <a href="../../download/">Download the CLI</a>.</p>` : ''}<div class="reading">${body}</div></article>`
  }));
}
write('updates', layout({
  title: 'Updates', description: 'Builder Garage project updates and source history.', current: 'updates/', depth: '../',
  body: `${pageHead('Shop log.', 'Project history, source revisions, and engineering decisions.')}
    <section class="content updates"><h2>Verified source snapshot</h2>
      <a href="${repo}/commit/${sha}"><code>${esc(version)} · ${shortSha}</code> · Source for this site build</a>
      <p>The website is pinned to this revision, not a live view of GitHub. Its Library contains ${skills.length} skills, ${manuals.length} manuals, and the CLI foundation.</p>
      <h2>Binary releases</h2>${releaseInfo}
      <a href="${repo}/tags">Version tags on GitHub ↗</a>
      <h2>Project record</h2><a href="${repo}/tree/${sha}/docs/adr">Architecture decision records ↗</a><a href="${repo}/blob/${sha}/docs/history.md">Project history ↗</a><p>Follow website source-snapshot updates with <a href="../rss.xml">RSS</a>.</p>
    </section>`
}));
write('contribute', layout({
  title: 'Contribute', description: 'How to contribute to Builder Garage.', depth: '../',
  body: `${pageHead('Help build the Garage.', 'Builder Garage is maintainer-led and community-contributed. GitHub is where changes are proposed and reviewed.')}
    <section class="content"><div class="path-grid">
      <article><h2>Ways to help</h2><p>Report a problem, propose a change, request discovery, improve documentation, or test a candidate practice. For an existing issue, request assignment and wait for a maintainer before starting.</p><a href="${repo}/issues/new/choose">Open an issue ↗</a><p><a href="../learn/first-contribution/">Your first contribution →</a></p></article>
      <article><h2>How a change moves</h2><p>Substantive changes pass independent engineering review before a pull request, then maintainer approval before merge. Neither replaces the other. External contributors can run implementation and review in separate execution contexts and post both records on the originating issue.</p><p>Human product-intent acceptance also applies. Inspecting user-facing results is required when the documented trigger holds. A sole maintainer's own pull request uses the documented explicit-acceptance exception, not a self-approving review.</p><a href="${repo}/blob/${sha}/CONTRIBUTING.md">Read contributing ↗</a></article>
      <article><h2>Project agreements</h2><p>Read the governance, conduct, and security policies before contributing. Report vulnerabilities privately as the security policy directs.</p><p><a href="${repo}/blob/${sha}/GOVERNANCE.md">Governance ↗</a> · <a href="${repo}/blob/${sha}/CODE_OF_CONDUCT.md">Conduct ↗</a> · <a href="${repo}/blob/${sha}/SECURITY.md">Security ↗</a></p></article>
    </div></section>`
}));
write('privacy', layout({
  title: 'Privacy policy', description: 'How buildergarage.app handles website visitor information.', depth: '../',
  body: `${pageHead('Privacy policy', 'How buildergarage.app handles information when you visit this website.')}
    <section class="content">
      <p>Last updated: November 18, 2026</p>
      <h2>Scope</h2>
      <p>This policy covers the buildergarage.app website. Third-party sites, including GitHub, and the Builder Garage CLI have their own practices.</p>
      <h2>Information and hosting</h2>
      <p>This site has no accounts or contact forms. It is hosted by Vercel, which may process information associated with requests, such as IP addresses, browser and device information, and request details, to deliver and secure the site. See <a href="https://vercel.com/legal/privacy-notice">Vercel's privacy notice</a> for its practices.</p>
      <p>Website code does not set cookies or include analytics or advertising trackers. Hosting or security providers may use their own technologies; consult their notices for details.</p>
      <h2>Features in your browser</h2>
      <p>The download page uses browser-provided platform information to suggest an operating system. This selection runs in your browser; the site code does not send it to us. You can choose a different system.</p>
      <p>Library search and filters run in your browser and update the page URL. Search terms may be kept in browser history or shared if you copy the URL, so avoid entering sensitive information. The copy button writes commands to your clipboard when you select it.</p>
      <h2>External sites and downloads</h2>
      <p>Links and CLI downloads may take you to GitHub or another external site, which can receive information about your visit under its own privacy notice. See <a href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement">GitHub's privacy statement</a>.</p>
      <h2>Questions</h2>
      <p>For questions about this policy, <a href="https://github.com/bdonaldharris/buildergarageapp/issues/new/choose">open an issue in the website repository</a>. GitHub issues are public: do not include sensitive or personal information.</p>
    </section>`
}));
write('404', layout({title:'404 - Nothing on this shelf',description:'Page not found.',depth:'/',body:`<section class="page-head"><div><h1>Nothing on this shelf.</h1><p>Page not found. Try the Library or return to the workshop floor.</p><p class="actions"><a class="button" href="/">Home</a><a class="button secondary" href="/library/">Library</a></p></div></section>`}));
copy(resolve(out, '404/index.html'), resolve(out, '404.html'));
const rss = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Builder Garage Shop Log</title><link>https://buildergarage.app/updates/</link><description>Builder Garage source updates and engineering decisions.</description><item><title>Library built from ${shortSha}</title><link>${repo}/commit/${sha}</link><guid>${sha}</guid><description>Static library built from the current pinned Builder Garage source.</description></item></channel></rss>`;
writeFileSync(resolve(out,'rss.xml'),rss); writeFileSync(resolve(out,'_redirects'), '/* /404.html 404\n');
writeFileSync(resolve(out, 'source.json'), JSON.stringify({ repo, revision: sha, version, goVersion, artifacts, guides: guideFiles.map(([slug, title, path]) => ({ title, path, url: `/learn/${slug}/` })) }, null, 2) + '\n');
console.log(`Built ${artifacts.length} artifacts from ${shortSha} (${version}).`);

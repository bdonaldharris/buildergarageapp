# buildergarage.app

Static public website for Builder Garage. The site is generated from the GitHub revision pinned in `framework-source.json`, not a hand-maintained artifact catalog.

## Build

```sh
npm ci
npm run build
```

Use Node.js 20 or newer, plus `tar`, `zip`, and `unzip` (`unzip` is used by checks). The first build downloads the pinned source archive from GitHub over HTTPS and caches it under `.cache/framework/<revision>/`. Subsequent builds reuse that snapshot. Download failures stop the build; the generator does not fall back to another revision. Go is needed to build the framework CLI, not this website.

To preview a local framework checkout instead:

```sh
BUILDER_GARAGE_SOURCE=/absolute/path/to/builder-garage npm run build
```

The build displays the source revision and version, reads the Go requirement from `go.mod`, parses skill and manual frontmatter (including Technician roles), produces permanent artifact pages and source-backed guides, and creates skill ZIPs and exact manual Markdown downloads. `dist/source.json` records the generated catalog and its provenance. `dist/` is deployable as a static Vercel site.

## Updating the framework snapshot

Resolve the upstream default branch to a full commit SHA, verify its version tag, and update `revision` and `version` in `framework-source.json`. Then review the upstream README, CLI commands, configuration and skill-installation contracts, manuals, Crew roles, review evidence, and contribution process against the summaries in `scripts/build.mjs`. Catalog counts, roles, descriptions, downloads, guides, and the Go requirement come from the snapshot; editorial capability summaries still require this review.

The current verified source snapshot is `v0.1.1` (`7c062921a2f2c380da1031fad1e60cfe06a4c944`): six canonical skills, three provisional technology manuals, the source installer, project configuration commands, local workflow records, managed skill/manual installation, and read-only GitHub status. It is separate from the CLI release listed in `release.json`. Agent orchestration, AI-provider connections, plugins, remote services, libraries, adapters, and SDKs are not implemented in this snapshot.

## CLI releases

The download page reads `release.json`, a checked-in manifest of the latest stable CLI release, its tagged commit, and GitHub asset URLs. Run `node scripts/update-release.mjs` to refresh it from the GitHub API; use `GITHUB_TOKEN` if unauthenticated API limits are a concern. The updater refuses missing archives, checksum/signature assets, incomplete package sets, or invalid asset URLs rather than publishing partial downloads. The manifest does not update the separate `framework-source.json` pin. Check the linked release notes for platform signing status; the manifest does not infer signing.

The download page presents operating systems as selectable controls, defaulting to a detected desktop OS when possible. All downloads remain visible when the OS is unknown or JavaScript is unavailable.

`.github/workflows/update-release.yml` runs daily at 06:17 UTC and can also be started manually. When the release changes, it validates the site, commits the manifest and tracked generated output, and pushes to `main`, allowing the Vercel Git integration to deploy. It requires Actions `contents: write` permission and a branch that permits the workflow token to push. GitHub schedules are best effort; API, validation, push, or deployment failures require attention in the Actions or Vercel dashboard. A GitHub Actions bot push must be accepted by the connected Vercel project.

Run `npm run check` before publishing. It checks Markdown rendering, generated links and fragments, source references, fonts, catalog metadata, and the contents of downloads against the selected framework snapshot.

## Site design

Edit `site.css` for the sectioned stylesheet, `site.js` for interactions, and `scripts/build.mjs` for page markup, then rebuild. Treat `dist/` as generated output.

Brand images and self-hosted Latin-subset Archivo, Inter, and JetBrains Mono fonts live in `assets/` and are copied into each build. Font faces use `font-display: swap`; the display and body faces used above the fold are preloaded. Font licenses are included in `assets/fonts/OFL-*.txt`. No external font service or temporary handoff directory is required.

The homepage leads with a prominent centered logo above the headline and copyable source-build snippet, followed by a five-step workflow. Open shop-floor columns and ruled adoption paths lead to CLI, Skills, and Manuals category links that open the corresponding Library filter.

Page and section headings establish hierarchy without eyebrow labels. Workflow step numbers, status badges, and artifact tags remain functional UI.

External web links, including links in source-backed guides, open in a new tab with `noopener noreferrer`. Internal links, downloads, and email links retain their normal behavior.

The footer links to a website privacy policy generated in `scripts/build.mjs`. Review it whenever hosting, analytics, browser-side behavior, or the privacy contact changes.

Learn guides use a 1200px article shell with prose capped at 75ch. Tables and code can use the full inner width; tables use 16px text and keyboard-focusable horizontal scrolling when needed. Mobile guides retain 16px gutters.

Keep build provenance out of the main reading flow: Updates holds the framework version and revision, linked as "Source details" from every footer. Artifact revisions and skill file inventories live in collapsed technical details; roles, provisional status, and installation requirements stay visible. Guide headers link to their pinned source without repeating repository paths or revisions. The source manifest, installation commands, downloads, and upstream guide content retain their technical detail. The source-build guide explicitly labels its release-availability corrections because the tagged README predates publication; other source content is unchanged. Review those corrections when updating the snapshot.

## Publish

Run `npm run build`, deploy `dist/` as a static Vercel output, and use the generated `rss.xml`. The repository's `vercel.json` sets the Output Directory to `dist` rather than Vercel's default `public`. No server, database, analytics, or authentication is required.

Homepage links use `/`; Vercel permanently redirects legacy `/index.html` requests to `/`.


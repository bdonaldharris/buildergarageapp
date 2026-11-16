# buildergarage.app

Static public website for Builder Garage. The site is generated from a pinned local checkout of the Builder Garage framework, not a hand-maintained artifact catalog.

## Build

```sh
npm run build
```

By default the generator reads `../Builder Garage`. To use another checkout:

```sh
BUILDER_GARAGE_SOURCE=/absolute/path/to/builder-garage npm run build
```

The build resolves and displays that checkout's current commit, parses `skills/*/SKILL.md`, produces one permanent detail page per artifact, copies source-backed assets, and creates a `.zip` for each skill. `dist/` is deployable as a static Vercel site.

## Current source behavior

The present framework checkout is pinned during each build. Its actual capabilities control the site: no manuals, per-skill metadata beyond SKILL.md, published CLI binaries, or CLI skill-install/config commands are assumed. When the upstream framework adds those capabilities, extend the generator rather than manually editing a catalog.

## Publish

Run `npm run build`, deploy `dist/` as a static Vercel output, and use the generated `rss.xml`. No server, database, analytics, or authentication is required.


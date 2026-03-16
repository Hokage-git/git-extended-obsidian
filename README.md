# Git Extended for Obsidian

Git Extended is an Obsidian plugin for working with multiple nested Git repositories from a dedicated sidebar view. It is aimed at vaults that contain several projects and need a faster way to inspect status, stage work mentally, and trigger common Git actions without leaving Obsidian.

## Features

- Discover nested Git repositories inside the current vault
- Show repository status in a single sidebar view
- Surface common actions for refresh, commit flow, and repository management
- Keep plugin behavior focused on desktop Obsidian workflows

## Manual Installation

1. Build the plugin with `npm run build`.
2. Copy `main.js`, `manifest.json`, and `styles.css` into your vault at `.obsidian/plugins/git-extended-obsidian/`.
3. Reload Obsidian and enable **Git Extended** in community plugins.

## Development

Install dependencies:

```bash
npm ci
```

Run the test suite:

```bash
npm test
```

Build the plugin:

```bash
npm run build
```

## Release Flow

`manifest.json` is the source of truth for the plugin version.

To publish a new release:

1. Change `version` in `manifest.json`.
2. Commit the version bump.
3. Create and push a matching tag in the form `v<version>`, for example `v1.0.0`.

GitHub Actions will then:

- install dependencies;
- verify that the pushed tag matches `manifest.json.version`;
- run tests and build the plugin;
- package `main.js`, `manifest.json`, and `styles.css` into `git-extended-obsidian-<version>.zip`;
- publish that zip archive to the GitHub Release.

You can also build the release archive locally after a production build:

```bash
npm run build
npm run package:release
```

The generated archive is written to `release/`.

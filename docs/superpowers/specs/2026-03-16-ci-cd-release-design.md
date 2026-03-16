# CI/CD Release Design

## Goal

Add GitHub Actions CI/CD for this Obsidian plugin so that pushes and pull requests validate the project, and version tags publish a GitHub Release containing only a versioned zip archive.

## Scope

- Add continuous integration for test and build validation.
- Add tagged release automation for `v*` tags.
- Treat `manifest.json` as the single source of truth for plugin versioning.
- Package only `main.js`, `manifest.json`, and `styles.css` into the release zip.
- Add repository documentation that explains local development and the release flow.

## Non-Goals

- Publishing plugin files as loose release assets.
- Supporting non-Windows release packaging in CI.
- Publishing to any registry other than GitHub Releases.

## Architecture

The repository will gain two GitHub Actions workflows under `.github/workflows`:

- `ci.yml` runs on `push` to `main` and on all pull requests. It installs dependencies, runs tests, and builds the plugin.
- `release.yml` runs on pushes of tags matching `v*`. It installs dependencies, verifies the tag matches the plugin version in `manifest.json`, runs tests and the production build, packages a zip archive, and publishes a GitHub Release with that archive only.

Release logic will be implemented in a small testable module in `src/release`. Thin scripts in `scripts/` will call this module from GitHub Actions and local development. This keeps packaging and version checks testable without coupling the implementation to GitHub Actions YAML.

## Versioning

- `manifest.json.version` is the source of truth.
- Releasing a new version requires changing `manifest.json.version`.
- The Git tag must match the manifest version in the form `v<version>`.
- The initial release version for this setup is `1.0.0`.

## Packaging

The release archive name format is:

- `git-extended-obsidian-<version>.zip`

The archive contents are:

- `main.js`
- `manifest.json`
- `styles.css`

The archive is created in `release/`.

## Error Handling

The release verification script fails if:

- the current ref is not a tag;
- the tag does not start with `v`;
- the tag version does not match `manifest.json.version`;
- `manifest.json` cannot be read or does not contain a version.

The packaging script fails if:

- the build artifacts do not exist;
- the release directory cannot be created;
- the zip archive cannot be written.

## Testing

Release behavior will be validated with automated tests for:

- extracting the plugin version from `manifest.json`;
- validating the release tag against the manifest version;
- computing the archive file name and required release file list.

Workflow behavior will be verified through local script execution plus `npm test` and `npm run build`.

## Documentation

Add a repository `README.md` describing:

- what the plugin does;
- how to install it manually;
- how to develop and test it locally;
- how versioning and GitHub Releases work.

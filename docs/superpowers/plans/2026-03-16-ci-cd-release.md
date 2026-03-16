# CI/CD Release Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add CI validation, tagged GitHub Releases with a versioned zip archive, and repository documentation aligned with the release flow.

**Architecture:** Keep workflow YAML thin and move release logic into a small `src/release` module covered by tests. Use `manifest.json` as the version source of truth and package only the built plugin files into a zip archive published by GitHub Actions.

**Tech Stack:** TypeScript, Vitest, Node.js scripts, GitHub Actions, PowerShell zip packaging on Windows

---

## Chunk 1: Release logic

### Task 1: Add tests for manifest version and release tag validation

**Files:**
- Create: `tests/release/release-utils.test.ts`
- Create: `src/release/release-utils.ts`

- [ ] **Step 1: Write the failing test**

Add tests that define:
- reading `version` from manifest content;
- accepting matching refs like `refs/tags/v1.0.0`;
- rejecting mismatched tags and malformed refs;
- computing `git-extended-obsidian-<version>.zip`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/release/release-utils.test.ts`
Expected: FAIL because `src/release/release-utils.ts` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

Add pure helpers in `src/release/release-utils.ts` for:
- parsing the manifest version;
- validating a tag ref against a version;
- listing required release files;
- generating the archive name.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/release/release-utils.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/release/release-utils.test.ts src/release/release-utils.ts
git commit -m "test: add release utility coverage"
```

## Chunk 2: Release scripts

### Task 2: Add script entry points for release verification and packaging

**Files:**
- Create: `scripts/verify-release-tag.mjs`
- Create: `scripts/package-release.mjs`
- Modify: `package.json`

- [ ] **Step 1: Write the failing test**

Add one more test in `tests/release/release-utils.test.ts` that locks the release file list and archive naming expected by packaging.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/release/release-utils.test.ts`
Expected: FAIL until implementation covers the packaging shape.

- [ ] **Step 3: Write minimal implementation**

Add two thin scripts:
- `verify-release-tag.mjs` reads `manifest.json`, uses `GITHUB_REF`, and exits non-zero on mismatch.
- `package-release.mjs` reads `manifest.json`, verifies built files exist, creates `release/`, and uses PowerShell `Compress-Archive` to build the zip.

Update `package.json` with:
- version `1.0.0`;
- script `package:release`.

- [ ] **Step 4: Run targeted verification**

Run:
- `npm test -- tests/release/release-utils.test.ts`
- `node scripts/verify-release-tag.mjs` with a matching `GITHUB_REF`

Expected: tests pass and the verification script exits successfully.

- [ ] **Step 5: Commit**

```bash
git add scripts/verify-release-tag.mjs scripts/package-release.mjs package.json tests/release/release-utils.test.ts
git commit -m "feat: add release scripts"
```

## Chunk 3: Workflows and docs

### Task 3: Add GitHub Actions workflows and README

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `.github/workflows/release.yml`
- Create or modify: `README.md`
- Modify: `manifest.json`

- [ ] **Step 1: Write the failing test**

No new automated test is required for workflow YAML. Reuse script-level verification and full project validation.

- [ ] **Step 2: Make the configuration changes**

Add:
- CI workflow for `npm ci`, `npm test`, `npm run build`;
- Release workflow for tag validation, test, build, packaging, and GitHub Release upload;
- `README.md` describing usage, development, and release versioning;
- `manifest.json.version` bumped to `1.0.0`.

- [ ] **Step 3: Run full verification**

Run:
- `npm test`
- `npm run build`
- `node scripts/package-release.mjs`

Expected: all tests pass, build succeeds, and `release/git-extended-obsidian-1.0.0.zip` is created.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml .github/workflows/release.yml README.md manifest.json release
git commit -m "feat: add ci cd release pipeline"
```

# Multi Repo Git Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an Obsidian desktop plugin that discovers nested Git repositories inside one vault and lets the user inspect status, stage or unstage files, commit, pull, and push each repository independently.

**Architecture:** Implement a dedicated Obsidian sidebar view backed by three focused units: repository discovery, Git command execution, and a lightweight controller that coordinates refresh and repo-local actions. Keep Git parsing and process execution out of the view layer so the UI remains a thin renderer over structured repository state.

**Tech Stack:** TypeScript, Obsidian plugin API, Node.js child process APIs, Vitest or the repo-standard test runner, CSS for plugin view styling

---

## File Structure

Planned files and responsibilities:

- Create: `manifest.json`
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `esbuild.config.mjs`
- Create: `.gitignore`
- Create: `main.ts`
- Create: `src/types.ts`
- Create: `src/git/status-parser.ts`
- Create: `src/git/git-service.ts`
- Create: `src/discovery/repo-discovery-service.ts`
- Create: `src/controller/multi-repo-controller.ts`
- Create: `src/ui/multi-repo-view.ts`
- Create: `styles.css`
- Create: `tests/git/status-parser.test.ts`
- Create: `tests/discovery/repo-discovery-service.test.ts`
- Create: `tests/controller/multi-repo-controller.test.ts`

Notes:

- `main.ts` should stay narrow and only wire plugin lifecycle, commands, and view registration.
- `src/types.ts` will hold shared domain types to avoid circular imports.
- `src/git/status-parser.ts` owns porcelain parsing only.
- `src/git/git-service.ts` owns shell command execution and command composition only.
- `src/discovery/repo-discovery-service.ts` owns recursive scan logic only.
- `src/controller/multi-repo-controller.ts` owns loading, repo-local refresh, and busy-state rules.
- `src/ui/multi-repo-view.ts` owns rendering and event wiring only.
- `src/ui/repo-view-model.ts` owns compact display helpers, summary badges, and commit placeholders.
- `src/ui/confirm-modal.ts` owns confirmation UX for destructive discard flows.

## Chunk 1: Scaffold Plugin Project

### Task 1: Create package metadata and build config

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `esbuild.config.mjs`
- Create: `.gitignore`
- Create: `manifest.json`

- [ ] **Step 1: Write the failing smoke test target**

Document the expected first verification command before any code exists:

```bash
npm test
```

Expected: test command fails because project files and test runner are not configured yet.

- [ ] **Step 2: Create `package.json`**

Include:

- plugin package name
- build scripts
- dev dependency on `obsidian`
- test dependency using the repo-standard runner, preferably `vitest`
- TypeScript and bundling dependencies

- [ ] **Step 3: Create `tsconfig.json`**

Configure:

- `target` and `module` compatible with Obsidian plugin builds
- `rootDir` covering source and tests
- strict TypeScript mode
- Node and DOM libs if required by Obsidian typings

- [ ] **Step 4: Create `esbuild.config.mjs`**

Bundle `main.ts` into the plugin output expected by Obsidian and copy plugin metadata as needed.

- [ ] **Step 5: Create `.gitignore` and `manifest.json`**

Ignore:

- `node_modules`
- build output
- coverage output

Set manifest values:

- plugin id
- plugin name
- version
- minimum app version
- description
- author

- [ ] **Step 6: Run dependency-free verification**

Run:

```bash
Get-Content package.json
```

Expected: package metadata exists and scripts are present.

- [ ] **Step 7: Commit scaffold config**

```bash
git add package.json tsconfig.json esbuild.config.mjs .gitignore manifest.json
git commit -m "chore: scaffold obsidian plugin config"
```

## Chunk 2: Define Domain Types and Status Parsing

### Task 2: Add shared Git domain types

**Files:**
- Create: `src/types.ts`
- Test: `tests/git/status-parser.test.ts`

- [ ] **Step 1: Write the failing parser test skeleton**

```ts
import { describe, expect, it } from "vitest";

describe("status parser", () => {
  it("groups staged unstaged and untracked files", () => {
    expect(true).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify failure**

Run:

```bash
npm test -- tests/git/status-parser.test.ts
```

Expected: FAIL because test and parser implementation are incomplete.

- [ ] **Step 3: Create `src/types.ts`**

Define:

- `RepoInfo`
- `RepoFileChange`
- `RepoState`
- `RepoStatusSnapshot`
- `GitCommandResult`

Keep these types UI-oriented and small.

- [ ] **Step 4: Replace placeholder test with real parser expectations**

Cover cases for:

- branch line parsing
- staged modification
- unstaged modification
- untracked file
- rename
- conflict line

- [ ] **Step 5: Add `src/git/status-parser.ts` with minimal implementation**

Implement:

- `parseStatusPorcelain(output: string): RepoStatusSnapshot`
- normalization from porcelain codes into staged, unstaged, and untracked collections

- [ ] **Step 6: Run parser tests**

Run:

```bash
npm test -- tests/git/status-parser.test.ts
```

Expected: PASS

- [ ] **Step 7: Commit parser foundation**

```bash
git add src/types.ts src/git/status-parser.ts tests/git/status-parser.test.ts
git commit -m "feat: parse git porcelain status"
```

## Chunk 3: Implement Repository Discovery

### Task 3: Add recursive nested repo discovery

**Files:**
- Create: `src/discovery/repo-discovery-service.ts`
- Create: `tests/discovery/repo-discovery-service.test.ts`

- [ ] **Step 1: Write failing discovery tests**

Cover:

- finds a single repo root
- finds nested repos independently
- returns relative paths from vault root
- ignores directories without `.git`

- [ ] **Step 2: Run the discovery tests to verify failure**

Run:

```bash
npm test -- tests/discovery/repo-discovery-service.test.ts
```

Expected: FAIL because service does not exist yet.

- [ ] **Step 3: Implement `RepoDiscoveryService`**

Add a function similar to:

```ts
async function discoverRepositories(vaultPath: string): Promise<string[]>
```

Requirements:

- recurse through directories
- detect `.git` entry
- continue descending so nested repos are preserved
- normalize returned paths for Windows-safe comparisons

- [ ] **Step 4: Add helper to convert absolute paths to `RepoInfo` seed data**

Return:

- `rootPath`
- `relativePath`
- empty branch placeholder until status load

- [ ] **Step 5: Run discovery tests**

Run:

```bash
npm test -- tests/discovery/repo-discovery-service.test.ts
```

Expected: PASS

- [ ] **Step 6: Commit discovery service**

```bash
git add src/discovery/repo-discovery-service.ts tests/discovery/repo-discovery-service.test.ts
git commit -m "feat: discover nested git repositories"
```

## Chunk 4: Implement Git Command Execution

### Task 4: Add Git command process wrapper

**Files:**
- Create: `src/git/git-service.ts`
- Modify: `src/types.ts`
- Test: `tests/controller/multi-repo-controller.test.ts`

- [ ] **Step 1: Write failing tests for Git command orchestration**

Mock process execution and cover:

- status command success
- stage file
- unstage file
- commit with message
- pull
- push
- command failure preserves stderr

- [ ] **Step 2: Run the controller-oriented tests to verify failure**

Run:

```bash
npm test -- tests/controller/multi-repo-controller.test.ts
```

Expected: FAIL because Git service does not exist yet.

- [ ] **Step 3: Implement process runner in `src/git/git-service.ts`**

Requirements:

- execute commands in a provided repo root
- capture stdout, stderr, exit code
- reject or return structured failure consistently

- [ ] **Step 4: Implement high-level methods**

Add methods:

- `getStatus(repoRoot)`
- `stageFile(repoRoot, filePath)`
- `unstageFile(repoRoot, filePath)`
- `commit(repoRoot, message)`
- `pull(repoRoot)`
- `push(repoRoot)`
- `checkGitAvailability()`

- [ ] **Step 5: Ensure `getStatus` uses `parseStatusPorcelain`**

This keeps parsing logic centralized and testable.

- [ ] **Step 6: Run Git service tests**

Run:

```bash
npm test -- tests/controller/multi-repo-controller.test.ts
```

Expected: PASS

- [ ] **Step 7: Commit Git service**

```bash
git add src/git/git-service.ts src/types.ts tests/controller/multi-repo-controller.test.ts
git commit -m "feat: add git command service"
```

## Chunk 5: Implement Controller and State Coordination

### Task 5: Add the multi-repo controller

**Files:**
- Create: `src/controller/multi-repo-controller.ts`
- Modify: `tests/controller/multi-repo-controller.test.ts`

- [ ] **Step 1: Expand controller tests with behavior scenarios**

Cover:

- loads all repositories on startup
- refreshes one repository after stage
- blocks conflicting repo-local actions while busy
- preserves errors on one repo without dropping others
- updates commit message per repository

- [ ] **Step 2: Run controller tests to verify failure**

Run:

```bash
npm test -- tests/controller/multi-repo-controller.test.ts
```

Expected: FAIL because controller is not implemented yet.

- [ ] **Step 3: Implement `MultiRepoController`**

Responsibilities:

- hold current list of `RepoState`
- expose subscribe or callback-based updates for the view
- load all repos via discovery plus Git status
- refresh one repo after action success

- [ ] **Step 4: Add repo-local busy-state guard**

Rules:

- only one mutating operation per repository at a time
- one failing repo must not block other repos

- [ ] **Step 5: Add commit message state methods**

Expose:

- `setCommitMessage(repoRoot, value)`
- `clearCommitMessage(repoRoot)` after successful commit

- [ ] **Step 6: Run controller tests**

Run:

```bash
npm test -- tests/controller/multi-repo-controller.test.ts
```

Expected: PASS

- [ ] **Step 7: Commit controller**

```bash
git add src/controller/multi-repo-controller.ts tests/controller/multi-repo-controller.test.ts
git commit -m "feat: coordinate multi repo state"
```

## Chunk 6: Build the Obsidian View

### Task 6: Implement sidebar rendering and action wiring

**Files:**
- Create: `src/ui/multi-repo-view.ts`
- Modify: `src/types.ts`
- Modify: `src/controller/multi-repo-controller.ts`

- [ ] **Step 1: Write the UI contract before rendering**

Document the expected interactions in comments or test notes:

- open view
- see repo cards
- click stage or unstage
- type commit message
- click commit pull push

For v1, automated DOM testing is optional if repo patterns do not already support it.

- [ ] **Step 2: Implement `MultiRepoView` skeleton**

Include:

- custom view type constant
- header with refresh action
- container for repository cards

- [ ] **Step 3: Implement repository card rendering**

Show:

- relative path
- branch
- repo-local error
- staged section
- changes section
- untracked section
- commit input
- action buttons

- [ ] **Step 4: Wire card actions to controller methods**

Each action must:

- disable the card while busy
- refresh the card on completion
- preserve commit input on failure

- [ ] **Step 5: Add clean and empty states**

Handle:

- no repositories found
- clean repository
- missing git binary

- [ ] **Step 6: Run typecheck and available UI verification**

Run:

```bash
npm run build
```

Expected: PASS and bundle emitted without TypeScript errors.

- [ ] **Step 7: Commit sidebar view**

```bash
git add src/ui/multi-repo-view.ts src/types.ts src/controller/multi-repo-controller.ts
git commit -m "feat: add multi repo sidebar view"
```

## Chunk 7: Wire Plugin Entry and Commands

### Task 7: Register the plugin with Obsidian

**Files:**
- Create: `main.ts`
- Modify: `manifest.json`

- [ ] **Step 1: Write the expected plugin lifecycle checklist**

Ensure implementation includes:

- onload registration
- view registration
- command registration
- onunload cleanup

- [ ] **Step 2: Implement `main.ts`**

Responsibilities:

- create `RepoDiscoveryService`
- create `GitService`
- create `MultiRepoController`
- register custom view
- add command to open the view
- add command to refresh all repositories

- [ ] **Step 3: Ensure view creation uses the active vault path**

If no vault path is available, surface a global error state via controller or view-safe fallback.

- [ ] **Step 4: Build the plugin**

Run:

```bash
npm run build
```

Expected: PASS

- [ ] **Step 5: Commit plugin wiring**

```bash
git add main.ts manifest.json
git commit -m "feat: wire obsidian multi repo plugin"
```

## Chunk 8: Add Styling and Manual Verification Notes

### Task 8: Add focused styling for repo cards

**Files:**
- Create: `styles.css`

- [ ] **Step 1: Write the visual goals**

The view should:

- look native to Obsidian
- keep repo cards clearly separated
- make busy and error states obvious

- [ ] **Step 2: Implement `styles.css`**

Style:

- sidebar layout
- card spacing
- section headings
- action row
- inline errors
- disabled and loading states

- [ ] **Step 3: Register styles in the plugin build if needed**

Ensure the stylesheet is shipped with the plugin.

- [ ] **Step 4: Run build verification**

Run:

```bash
npm run build
```

Expected: PASS

- [ ] **Step 5: Commit styling**

```bash
git add styles.css
git commit -m "style: add multi repo view styles"
```

### Task 9: Execute manual verification checklist

**Files:**
- Modify: `docs/superpowers/plans/2026-03-16-multi-repo-git.md`

- [ ] **Step 1: Install dependencies**

Run:

```bash
npm install
```

Expected: PASS

- [ ] **Step 2: Build the plugin**

Run:

```bash
npm run build
```

Expected: PASS and generated plugin artifacts available for Obsidian.

- [ ] **Step 3: Validate parser and controller tests**

Run:

```bash
npm test
```

Expected: PASS

- [ ] **Step 4: Validate inside Obsidian desktop with a sample vault**

Manual scenarios:

- one clean repo
- one repo with staged file
- one repo with unstaged file
- one repo with untracked file
- successful commit
- failed push
- failed pull conflict

- [ ] **Step 5: Record any manual verification deltas in this plan**

Add short notes under this task if implementation behavior differs from the original design.

## Risks And Guardrails

- Obsidian desktop exposes Node APIs, but process execution details may differ across plugin setups, so verify the chosen child process API early.
- Windows path handling is critical because the current environment is Windows. Normalize separators at boundaries and avoid direct string assumptions in tests.
- Nested repositories can be numerous in a large vault. Keep discovery simple in v1, but structure it so exclusions can be added later.
- `git restore --staged` may fail in edge cases on older Git versions. If compatibility becomes a problem, fall back to `git reset HEAD -- <path>`.
- `discard` is destructive. Every file, repo, and global discard path must require explicit modal confirmation and be backed by command-composition tests before wiring UI actions.

## Execution Order

1. Scaffold plugin config and test tooling.
2. Implement parser and discovery with tests first.
3. Implement Git service and controller.
4. Add the Obsidian view and plugin entry.
5. Add styling.
6. Run automated and manual verification.

## Chunk 9: Compact UX, Discard, and Collapsible Repositories

### Task 10: Add discard command coverage and git-service support

**Files:**
- Modify: `src/git/git-service.ts`
- Modify: `src/types.ts`
- Modify: `tests/git/git-service.test.ts`

- [ ] **Step 1: Write failing discard tests**

Cover:

- tracked file discard uses `git restore --staged --worktree -- <path>`
- untracked file discard deletes the file directly
- repository discard runs `git reset --hard HEAD`
- repository discard runs `git clean -fd`

- [ ] **Step 2: Run discard tests to verify failure**

Run:

```bash
npm test -- tests/git/git-service.test.ts
```

Expected: FAIL because discard methods do not exist yet.

- [ ] **Step 3: Implement discard methods in `src/git/git-service.ts`**

Add:

- `discardFile(repoRoot, filePath, tracked)`
- `discardRepo(repoRoot)`

- [ ] **Step 4: Run discard tests**

Run:

```bash
npm test -- tests/git/git-service.test.ts
```

Expected: PASS

### Task 11: Add controller support for discard and collapse state

**Files:**
- Modify: `src/controller/multi-repo-controller.ts`
- Modify: `src/types.ts`
- Modify: `tests/controller/multi-repo-controller.test.ts`

- [ ] **Step 1: Write failing controller tests**

Cover:

- dirty repositories default to expanded
- clean repositories default to collapsed
- toggling a repository changes only that repository
- file discard refreshes the affected repository
- repository discard refreshes the affected repository
- global discard iterates all repositories

- [ ] **Step 2: Run controller tests to verify failure**

Run:

```bash
npm test -- tests/controller/multi-repo-controller.test.ts
```

Expected: FAIL because discard and expansion logic do not exist yet.

- [ ] **Step 3: Implement controller behavior**

Add:

- `toggleRepoExpanded(repoRoot)`
- `discardFile(repoRoot, filePath, tracked)`
- `discardRepo(repoRoot)`
- `discardAll()`

- [ ] **Step 4: Run controller tests**

Run:

```bash
npm test -- tests/controller/multi-repo-controller.test.ts
```

Expected: PASS

### Task 12: Redesign view for compact accordion layout and discard actions

**Files:**
- Modify: `src/ui/multi-repo-view.ts`
- Modify: `src/ui/repo-view-model.ts`
- Create: `src/ui/confirm-modal.ts`
- Modify: `styles.css`
- Modify: `main.ts`
- Modify: `tests/ui/repo-view-model.test.ts`

- [ ] **Step 1: Write failing view-model tests for compact summary**

Cover:

- summary badge counts
- discard button labeling helpers if needed
- clean-state collapse helpers

- [ ] **Step 2: Run view-model tests to verify failure**

Run:

```bash
npm test -- tests/ui/repo-view-model.test.ts
```

Expected: FAIL because compact accordion helpers are incomplete.

- [ ] **Step 3: Implement compact accordion UI**

Include:

- global `Discard All`
- repo-level `Discard Repo`
- collapsible repo headers
- compact summary badges
- per-file hover `Discard`
- confirmation modals for all discard paths

- [ ] **Step 4: Run build and test verification**

Run:

```bash
npm run build
npm test
```

Expected: PASS

- [ ] **Step 5: Reinstall plugin into target vault**

Copy:

- `manifest.json`
- `main.js`
- `styles.css`

into:

- `C:\Users\Макс\Documents\UMKA\.obsidian\plugins\git-extended-obsidian`

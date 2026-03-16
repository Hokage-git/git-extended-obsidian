# Multi Repo Git Obsidian Plugin Design

**Date:** 2026-03-16
**Status:** Updated after UX redesign approval in chat

## Goal

Build an Obsidian desktop plugin that detects multiple nested Git repositories inside a single vault and shows each repository independently with its own status, staging controls, commit flow, pull, and push actions.

## First Version Scope

The first version is intentionally narrow:

- Desktop Obsidian only
- Uses system `git` available in `PATH`
- Auto-discovers repositories by scanning for `.git` directories inside the current vault
- Shows each repository as a separate unit in a dedicated sidebar view
- Supports per-repository `status`, `stage`, `unstage`, `commit`, `pull`, `push`, and full discard
- Supports file-level discard and global discard across all discovered repositories
- Supports collapsible repository cards with compact headers

Out of scope for v1:

- Mobile support
- Initializing new repositories
- Connecting repositories manually through settings
- Conflict resolution UI
- Branch switching, fetch-only, stash, rebase, or advanced Git workflows
- Integration with existing Obsidian Git plugins

## Product Behavior

The plugin adds a dedicated sidebar view named `Multi Repo Git`.

On opening the view, the plugin scans the vault recursively and detects every directory that contains a `.git` entry. Each detected repository is treated as an independent source control root even if it is nested inside another repository.

Each repository is rendered as its own card containing:

- Relative path inside the vault
- Current branch
- Compact summary of staged, changed, and untracked counts
- Separate sections for staged, unstaged, and untracked files
- Per-file hover actions for `Stage` or `Unstage`
- Per-file `Discard` action
- Commit message input
- `Commit`, `Pull`, `Push`, and `Discard Repo` actions
- Repository-local loading and error state
- Collapsed or expanded state

The whole view also contains global actions:

- `Refresh`
- `Discard All`

Repositories with no changes remain visible in a compact clean state so the user can still pull or push them independently.
Clean repositories should default to collapsed. Repositories with visible changes should default to expanded when loaded or refreshed.

## Architecture

The plugin should be implemented as a set of small focused units:

### 1. Plugin Entry

Responsible for:

- Registering the custom sidebar view
- Registering commands such as `Open Multi Repo Git` and `Refresh Multi Repo Git`
- Creating shared services
- Wiring lifecycle hooks for initial load and unload

### 2. RepoDiscoveryService

Responsible for:

- Recursively scanning the vault root
- Detecting repository roots by locating `.git`
- Returning normalized repository metadata
- Ignoring directories that should not be descended into once a repository root has been found if that behavior is chosen explicitly

Design choice for v1:

- Nested repositories must be displayed independently
- Discovery must therefore continue scanning descendants even if a parent repository is found
- The service should still avoid obviously irrelevant directories such as Obsidian plugin cache folders if needed later, but no heavy exclusion system is required in v1

### 3. GitService

Responsible for executing Git commands in the context of one repository root.

Supported operations:

- Read branch and status
- Stage one file
- Unstage one file
- Discard one file back to current `HEAD`
- Discard one repository back to current `HEAD`
- Commit with message
- Pull
- Push

Primary status command:

- `git status --porcelain=v1 -b`

Other commands:

- `git add -- <path>`
- `git restore --staged -- <path>`
- `git restore --staged --worktree -- <path>` for tracked file discard
- deleting untracked files on file discard
- `git reset --hard HEAD` for repository discard
- `git clean -fd` for repository discard of untracked files
- `git commit -m <message>`
- `git pull`
- `git push`
- `git branch --show-current` only if needed as fallback

The service returns structured results and stderr for UI display. It must not leak raw process handling into the view layer.

### 4. State / Refresh Coordinator

Responsible for:

- Loading all repository states on view open
- Refreshing all repositories manually
- Refreshing only one repository after a repo-local operation
- Preventing concurrent conflicting operations for the same repository
- Running global discard sequentially across repositories
- Storing repo UI state such as collapsed or expanded status

This can be implemented as a lightweight controller rather than a formal store for v1.

### 5. MultiRepoView

Responsible for:

- Rendering the repository list
- Rendering sections inside each repository card
- Dispatching user actions to the coordinator
- Showing repo-local spinners, disabled controls, and error messages

## Data Model

### RepoInfo

- `rootPath: string`
- `relativePath: string`
- `branch: string`

### RepoFileChange

- `path: string`
- `x: string`
- `y: string`
- `kind: 'staged' | 'modified' | 'deleted' | 'untracked' | 'renamed' | 'conflict'`

### RepoState

- `repo: RepoInfo`
- `staged: RepoFileChange[]`
- `unstaged: RepoFileChange[]`
- `untracked: RepoFileChange[]`
- `commitMessage: string`
- `isLoading: boolean`
- `isBusy: boolean`
- `isExpanded: boolean`
- `lastError?: string`

## Status Parsing

`git status --porcelain=v1 -b` is the source of truth.

Parsing rules for v1:

- Header line yields branch information
- `??` becomes untracked
- `A`, `M`, `D`, `R` in the index position contribute to staged changes
- `M`, `D` in the worktree position contribute to unstaged changes
- Conflict markers are surfaced as conflict entries and block clean-state assumptions

The parser should normalize Git output into UI-focused categories rather than exposing raw porcelain codes directly in rendering code.

## UI Behavior

### View Layout

Top-level view contains:

- Header with title
- `Refresh` action
- `Discard All` action
- Scrollable list of repository cards

### Repository Card Layout

Each card contains:

- Repo path and branch
- Collapse toggle
- Compact summary badges
- Optional inline error banner
- `Staged` section
- `Changes` section
- `Untracked` section
- Commit message input
- Action buttons

### Action Rules

- `Commit` is disabled when commit message is empty
- `Commit` is disabled when there are no staged changes
- `Pull`, `Push`, and `Commit` disable the card while running
- `Discard` actions also disable the relevant card while running
- `Stage` and `Unstage` refresh only the affected repository on success
- File-level `Discard` refreshes only the affected repository on success
- Repository-level `Discard Repo` refreshes only the affected repository on success
- Global refresh updates all repositories
- `Discard All` iterates across all repositories after a single confirmation modal
- All discard actions must use confirmation modals
- File row actions stay hidden until hover or focus

### Empty States

- If no repositories are found, the view shows a clear empty state
- If a repository is clean, its file sections collapse into a minimal clean summary
- If Git is missing, the entire view shows one global blocking error
- If a repository is collapsed, only the compact header is shown

## Error Handling

### Global Errors

Global blocking error is used only for environment-level failures:

- `git` binary missing
- vault path unavailable

### Repository Errors

Repository-local errors are shown inline on the corresponding card:

- command failure on `pull`, `push`, or `commit`
- command failure on file or repository discard
- permission issues
- malformed repository state

The plugin must keep the rest of the repositories usable even if one repository fails.

### Conflict Handling

Merge conflicts are not resolved in the UI in v1.

Expected behavior:

- Surface conflict entries in the status list
- Show command stderr if pull or merge fails
- Leave repository visible and refreshable

## Technical Constraints

- Desktop-only implementation
- No mobile fallback path
- No embedded Git library required for v1 if system process execution is reliable
- Must follow Obsidian plugin conventions and lifecycle
- Must keep file and process logic separate from rendering logic

## Testing Strategy

### Automated

Unit tests should cover:

- Recursive repository discovery
- Parsing porcelain status output into staged, unstaged, and untracked sections
- Mapping error output into repository state

### Manual

Manual verification should cover at minimum:

- Vault with two or more nested repositories
- Clean repository
- Repository with staged files
- Repository with unstaged files
- Repository with untracked files
- Successful commit
- Failed commit due to empty message
- Failed push due to remote/auth error
- Failed pull due to merge conflict
- File discard on tracked file
- File discard on untracked file
- Repository discard with mixed staged and untracked files
- Global discard across multiple repositories
- Collapsed and expanded repo behavior after refresh

## Implementation Notes

The first version should prioritize correctness and separation of repository state over visual complexity. The key success criterion is that each repository behaves as an independent source control block inside one Obsidian vault, similar to a multi-root source control experience in VS Code.

## Open Follow-Ups For Later Versions

- Settings for scan exclusions
- Repository collapse persistence
- Branch switching
- Fetch and sync status indicators
- Diff preview
- Better conflict indicators
- Integration with Obsidian commands or status bar

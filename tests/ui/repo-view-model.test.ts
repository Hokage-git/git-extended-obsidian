import { describe, expect, it } from "vitest";

import type { RepoState } from "../../src/types";
import {
  getChangeBadge,
  getCommitPlaceholder,
  getGlobalSummaryItems,
  getRepoSummaryItems,
  shouldShowCleanState
} from "../../src/ui/repo-view-model";

function createRepoState(overrides: Partial<RepoState> = {}): RepoState {
  return {
    repo: {
      branch: "main",
      relativePath: "projects/alpha",
      rootPath: "C:/vault/projects/alpha"
    },
    staged: [],
    unstaged: [],
    untracked: [],
    lastPulledChanges: [],
    commitMessage: "",
    isBusy: false,
    isExpanded: false,
    isLoading: false,
    isSelected: true,
    ...overrides
  };
}

describe("repo view model helpers", () => {
  it("builds a commit placeholder from the repo name when files are staged", () => {
    const repoState = createRepoState({
      staged: [
        {
          kind: "modified",
          path: "note.md",
          x: "M",
          y: " "
        }
      ]
    });

    expect(getCommitPlaceholder(repoState)).toBe("Commit staged changes in alpha");
  });

  it("guides the user to stage files before committing when staged list is empty", () => {
    expect(getCommitPlaceholder(createRepoState())).toBe("Stage files to create a commit");
  });

  it("returns compact badges for known git change kinds", () => {
    expect(getChangeBadge("modified")).toEqual({ label: "M", tone: "modified" });
    expect(getChangeBadge("untracked")).toEqual({ label: "U", tone: "untracked" });
    expect(getChangeBadge("renamed")).toEqual({ label: "R", tone: "renamed" });
    expect(getChangeBadge("deleted")).toEqual({ label: "D", tone: "deleted" });
    expect(getChangeBadge("conflict")).toEqual({ label: "!", tone: "conflict" });
  });

  it("shows the clean state only when the repo has no visible changes", () => {
    expect(shouldShowCleanState(createRepoState())).toBe(true);
    expect(
      shouldShowCleanState(
        createRepoState({
          untracked: [
            {
              kind: "untracked",
              path: "draft.md",
              x: "?",
              y: "?"
            }
          ]
        })
      )
    ).toBe(false);
  });

  it("returns compact summary badges for staged changed and untracked counts", () => {
    const repoState = createRepoState({
      staged: [
        { kind: "modified", path: "a.ts", x: "M", y: " " },
        { kind: "modified", path: "b.ts", x: "M", y: " " }
      ],
      unstaged: [{ kind: "modified", path: "c.ts", x: " ", y: "M" }],
      untracked: [{ kind: "untracked", path: "draft.md", x: "?", y: "?" }]
    });

    expect(getRepoSummaryItems(repoState)).toEqual([
      { label: "S", value: 2 },
      { label: "C", value: 1 },
      { label: "U", value: 1 }
    ]);
  });

  it("aggregates summary counters across all repositories", () => {
    const alpha = createRepoState({
      staged: [{ kind: "modified", path: "a.ts", x: "M", y: " " }],
      unstaged: [{ kind: "modified", path: "b.ts", x: " ", y: "M" }]
    });
    const beta = createRepoState({
      repo: {
        branch: "develop",
        relativePath: "projects/beta",
        rootPath: "C:/vault/projects/beta"
      },
      untracked: [{ kind: "untracked", path: "c.md", x: "?", y: "?" }]
    });

    expect(getGlobalSummaryItems([alpha, beta])).toEqual([
      { label: "S", value: 1 },
      { label: "C", value: 1 },
      { label: "U", value: 1 }
    ]);
  });
});

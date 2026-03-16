import type { RepoChangeKind, RepoState } from "../types";

export interface ChangeBadge {
  label: string;
  tone: RepoChangeKind | "modified";
}

export interface RepoSummaryItem {
  label: "S" | "C" | "U";
  value: number;
}

export function getCommitPlaceholder(repoState: RepoState): string {
  if (repoState.staged.length === 0) {
    return "Stage files to create a commit";
  }

  const segments = repoState.repo.relativePath.split("/").filter(Boolean);
  const repoName = segments.at(-1) ?? repoState.repo.relativePath ?? "repo";
  return `Commit staged changes in ${repoName}`;
}

export function getChangeBadge(kind: RepoChangeKind): ChangeBadge {
  switch (kind) {
    case "deleted":
      return { label: "D", tone: "deleted" };
    case "renamed":
      return { label: "R", tone: "renamed" };
    case "untracked":
      return { label: "U", tone: "untracked" };
    case "conflict":
      return { label: "!", tone: "conflict" };
    default:
      return { label: "M", tone: "modified" };
  }
}

export function shouldShowCleanState(repoState: RepoState): boolean {
  return (
    repoState.staged.length === 0 &&
    repoState.unstaged.length === 0 &&
    repoState.untracked.length === 0
  );
}

export function getRepoSummaryItems(repoState: RepoState): RepoSummaryItem[] {
  return [
    { label: "S", value: repoState.staged.length },
    { label: "C", value: repoState.unstaged.length },
    { label: "U", value: repoState.untracked.length }
  ];
}

export function getGlobalSummaryItems(repositories: RepoState[]): RepoSummaryItem[] {
  return repositories.reduce<RepoSummaryItem[]>(
    (items, repoState) => [
      { label: "S", value: items[0]!.value + repoState.staged.length },
      { label: "C", value: items[1]!.value + repoState.unstaged.length },
      { label: "U", value: items[2]!.value + repoState.untracked.length }
    ],
    [
      { label: "S", value: 0 },
      { label: "C", value: 0 },
      { label: "U", value: 0 }
    ]
  );
}

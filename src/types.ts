export type RepoChangeKind =
  | "staged"
  | "modified"
  | "deleted"
  | "untracked"
  | "renamed"
  | "conflict";

export interface RepoInfo {
  rootPath: string;
  relativePath: string;
  branch: string;
}

export interface RepoFileChange {
  path: string;
  x: string;
  y: string;
  kind: RepoChangeKind;
}

export type PulledChangeKind = "new" | "updated" | "deleted";

export interface PulledFileChange {
  path: string;
  kind: PulledChangeKind;
}

export interface RepoStatusSnapshot {
  branch: string;
  staged: RepoFileChange[];
  unstaged: RepoFileChange[];
  untracked: RepoFileChange[];
}

export interface RepoState {
  repo: RepoInfo;
  staged: RepoFileChange[];
  unstaged: RepoFileChange[];
  untracked: RepoFileChange[];
  lastPulledChanges: PulledFileChange[];
  commitMessage: string;
  isLoading: boolean;
  isBusy: boolean;
  isSelected: boolean;
  isExpanded: boolean;
  lastError?: string;
}

export interface GitCommandResult<T = void> {
  ok: boolean;
  stdout: string;
  stderr: string;
  data?: T;
}

export type RepoOperationKind = "pull" | "push";
export type RepoOperationStatus = "completed" | "pulled" | "upToDate" | "failed";

export interface PullResultData {
  status: "pulled" | "upToDate";
  files: PulledFileChange[];
}

export interface RepoOperationResult {
  operation: RepoOperationKind;
  repoRoot: string;
  repoPath?: string;
  ok: boolean;
  status: RepoOperationStatus;
  error?: string;
}

export interface BulkOperationResult {
  operation: RepoOperationKind;
  successCount: number;
  failureCount: number;
  details: RepoOperationResult[];
}

export interface ControllerState {
  gitAvailable: boolean;
  isLoading: boolean;
  repositories: RepoState[];
  error?: string;
}

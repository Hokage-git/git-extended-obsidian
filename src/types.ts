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
  commitMessage: string;
  isLoading: boolean;
  isBusy: boolean;
  lastError?: string;
}

export interface GitCommandResult<T = void> {
  ok: boolean;
  stdout: string;
  stderr: string;
  data?: T;
}

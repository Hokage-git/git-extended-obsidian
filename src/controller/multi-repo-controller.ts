import type {
  BulkOperationResult,
  ControllerState,
  GitCommandResult,
  PulledFileChange,
  PullResultData,
  RepoOperationKind,
  RepoOperationResult,
  RepoInfo,
  RepoState,
  RepoStatusSnapshot
} from "../types";
import { createAutoCommitMessage } from "./commit-message";

type GitService = {
  checkGitAvailability(): Promise<boolean>;
  getStatus(repoRoot: string): Promise<GitCommandResult<RepoStatusSnapshot>>;
  stageFile(repoRoot: string, filePath: string): Promise<GitCommandResult>;
  unstageFile(repoRoot: string, filePath: string): Promise<GitCommandResult>;
  discardFile(
    repoRoot: string,
    filePath: string,
    tracked: boolean
  ): Promise<GitCommandResult>;
  discardRepo(repoRoot: string): Promise<GitCommandResult>;
  commit(repoRoot: string, message: string): Promise<GitCommandResult>;
  pull(repoRoot: string): Promise<GitCommandResult<PullResultData>>;
  push(repoRoot: string): Promise<GitCommandResult>;
};

type ControllerDependencies = {
  discoverRepositories(vaultPath: string): Promise<RepoInfo[]>;
  gitService: GitService;
  now?: () => Date;
  vaultPath: string;
};

type StateListener = (state: ControllerState) => void;

function createRepoState(repo: RepoInfo): RepoState {
  return {
    repo,
    staged: [],
    unstaged: [],
    untracked: [],
    lastPulledChanges: [],
    commitMessage: "",
    isLoading: false,
    isBusy: false,
    isSelected: true,
    isExpanded: false
  };
}

function hasVisibleChanges(status: RepoStatusSnapshot): boolean {
  return (
    status.staged.length > 0 ||
    status.unstaged.length > 0 ||
    status.untracked.length > 0
  );
}

function mergeStatus(repoState: RepoState, status: RepoStatusSnapshot): RepoState {
  const dirty = hasVisibleChanges(status);
  return {
    ...repoState,
    repo: {
      ...repoState.repo,
      branch: status.branch
    },
    staged: status.staged,
    unstaged: status.unstaged,
    untracked: status.untracked,
    isExpanded: repoState.isExpanded || dirty,
    lastError: undefined
  };
}

export function createMultiRepoController({
  discoverRepositories,
  gitService,
  now = () => new Date(),
  vaultPath
}: ControllerDependencies) {
  let state: ControllerState = {
    gitAvailable: true,
    isLoading: false,
    repositories: []
  };
  const listeners = new Set<StateListener>();

  function emit(): void {
    for (const listener of listeners) {
      listener(state);
    }
  }

  function setState(nextState: ControllerState): void {
    state = nextState;
    emit();
  }

  function getSelectedRepositories(): RepoState[] {
    const selected = state.repositories.filter((repoState) => repoState.isSelected);
    return selected.length > 0 ? selected : state.repositories;
  }

  async function refreshRepo(repoRoot: string): Promise<void> {
    const repoIndex = state.repositories.findIndex(
      (repoState) => repoState.repo.rootPath === repoRoot
    );
    if (repoIndex === -1) {
      return;
    }

    const statusResult = await gitService.getStatus(repoRoot);
    const repositories = [...state.repositories];
    const current = repositories[repoIndex];

    if (!current) {
      return;
    }

    repositories[repoIndex] = statusResult.ok && statusResult.data
      ? mergeStatus(
          {
            ...current,
            isBusy: false,
            isLoading: false
          },
          statusResult.data
        )
      : {
          ...current,
          isBusy: false,
          isLoading: false,
          lastError: statusResult.stderr || "Failed to refresh repository status."
        };

    setState({
      ...state,
      repositories
    });
  }

  async function runRepoMutation<T = void>(
    repoRoot: string,
    action: () => Promise<GitCommandResult<T>>
  ): Promise<GitCommandResult<T>> {
    const repoIndex = state.repositories.findIndex(
      (repoState) => repoState.repo.rootPath === repoRoot
    );
    if (repoIndex === -1) {
      return {
        ok: false,
        stdout: "",
        stderr: "Repository not found."
      } as GitCommandResult<T>;
    }

    const current = state.repositories[repoIndex];
    if (!current || current.isBusy) {
      return {
        ok: false,
        stdout: "",
        stderr: "Repository is busy."
      } as GitCommandResult<T>;
    }

    const repositories = [...state.repositories];
    repositories[repoIndex] = {
      ...current,
      isBusy: true,
      lastError: undefined
    };
    setState({ ...state, repositories });

    const result = await action();
    if (!result.ok) {
      repositories[repoIndex] = {
        ...repositories[repoIndex],
        isBusy: false,
        lastError: result.stderr || "Git command failed."
      };
      setState({ ...state, repositories });
      return result;
    }

    await refreshRepo(repoRoot);
    return result;
  }

  function setLastPulledChanges(repoRoot: string, changes: PulledFileChange[]): void {
    setState({
      ...state,
      repositories: state.repositories.map((repoState) =>
        repoState.repo.rootPath === repoRoot
          ? { ...repoState, lastPulledChanges: changes }
          : repoState
      )
    });
  }

  function toRepoOperationResult(
    operation: RepoOperationKind,
    repoRoot: string,
    result: GitCommandResult<PullResultData | void>
  ): RepoOperationResult {
    const repoState = state.repositories.find((repo) => repo.repo.rootPath === repoRoot);
    return {
      operation,
      repoRoot,
      repoPath: repoState?.repo.relativePath || ".",
      ok: result.ok,
      status: !result.ok
        ? "failed"
        : operation === "pull" && result.data?.status === "upToDate"
          ? "upToDate"
          : operation === "pull"
            ? "pulled"
            : "completed",
      error: result.ok ? undefined : result.stderr || "Git command failed."
    };
  }

  async function runBulkRepoOperation(
    operation: RepoOperationKind,
    runner: (repoRoot: string) => Promise<RepoOperationResult>
  ): Promise<BulkOperationResult> {
    let successCount = 0;
    let failureCount = 0;
    const details: RepoOperationResult[] = [];

    for (const repository of getSelectedRepositories()) {
      const result = await runner(repository.repo.rootPath);
      details.push(result);
      if (result.ok) {
        successCount += 1;
      } else {
        failureCount += 1;
      }
    }

    return {
      operation,
      successCount,
      failureCount,
      details
    };
  }

  async function stageAllFilesForRepo(repoRoot: string): Promise<void> {
    const repo = state.repositories.find((repoState) => repoState.repo.rootPath === repoRoot);
    if (!repo || repo.isBusy) {
      return;
    }

    const filesToStage = [...repo.unstaged, ...repo.untracked].map((file) => file.path);
    if (filesToStage.length === 0) {
      return;
    }

    const repoIndex = state.repositories.findIndex(
      (repoState) => repoState.repo.rootPath === repoRoot
    );
    const repositories = [...state.repositories];
    repositories[repoIndex] = {
      ...repo,
      isBusy: true,
      lastError: undefined
    };
    setState({ ...state, repositories });

    for (const filePath of filesToStage) {
      const result = await gitService.stageFile(repoRoot, filePath);
      if (!result.ok) {
        repositories[repoIndex] = {
          ...repositories[repoIndex],
          isBusy: false,
          lastError: result.stderr || "Git command failed."
        };
        setState({ ...state, repositories });
        return;
      }
    }

    await refreshRepo(repoRoot);
  }

  return {
    subscribe(listener: StateListener): () => void {
      listeners.add(listener);
      listener(state);

      return () => {
        listeners.delete(listener);
      };
    },

    getState(): ControllerState {
      return state;
    },

    async load(): Promise<void> {
      setState({
        ...state,
        isLoading: true,
        error: undefined
      });

      const gitAvailable = await gitService.checkGitAvailability();
      if (!gitAvailable) {
        setState({
          gitAvailable: false,
          isLoading: false,
          repositories: [],
          error: "Git binary not found in PATH."
        });
        return;
      }

      const repoInfos = await discoverRepositories(vaultPath);
      const repositories = repoInfos.map(createRepoState);
      setState({
        gitAvailable: true,
        isLoading: false,
        repositories
      });

      for (const repo of repoInfos) {
        await refreshRepo(repo.rootPath);
      }
    },

    async refreshAll(): Promise<void> {
      for (const repository of state.repositories) {
        await refreshRepo(repository.repo.rootPath);
      }
    },

    async refreshRepo(repoRoot: string): Promise<void> {
      await refreshRepo(repoRoot);
    },

    async stageAllInRepo(repoRoot: string): Promise<void> {
      await stageAllFilesForRepo(repoRoot);
    },

    async stageAll(): Promise<void> {
      for (const repository of getSelectedRepositories()) {
        await stageAllFilesForRepo(repository.repo.rootPath);
      }
    },

    async discardFile(
      repoRoot: string,
      filePath: string,
      tracked: boolean
    ): Promise<void> {
      await runRepoMutation(repoRoot, () =>
        gitService.discardFile(repoRoot, filePath, tracked)
      );
    },

    async discardRepo(repoRoot: string): Promise<void> {
      await runRepoMutation(repoRoot, () => gitService.discardRepo(repoRoot));
    },

    async discardAll(): Promise<void> {
      for (const repository of getSelectedRepositories()) {
        await runRepoMutation(repository.repo.rootPath, () =>
          gitService.discardRepo(repository.repo.rootPath)
        );
      }
    },

    async stageFile(repoRoot: string, filePath: string): Promise<void> {
      await runRepoMutation(repoRoot, () => gitService.stageFile(repoRoot, filePath));
    },

    async unstageFile(repoRoot: string, filePath: string): Promise<void> {
      await runRepoMutation(repoRoot, () => gitService.unstageFile(repoRoot, filePath));
    },

    async commit(repoRoot: string): Promise<GitCommandResult | undefined> {
      const repo = state.repositories.find(
        (repoState) => repoState.repo.rootPath === repoRoot
      );
      if (!repo || repo.staged.length === 0) {
        return undefined;
      }

      const message = repo.commitMessage.trim() || createAutoCommitMessage(now());

      const result = await runRepoMutation(repoRoot, () =>
        gitService.commit(repoRoot, message)
      );

      const repositories = state.repositories.map((repoState) =>
        repoState.repo.rootPath === repoRoot
          ? { ...repoState, commitMessage: repoState.lastError ? repoState.commitMessage : "" }
          : repoState
      );
      setState({ ...state, repositories });
      return result;
    },

    async pull(repoRoot: string): Promise<RepoOperationResult> {
      const result = await runRepoMutation(repoRoot, () => gitService.pull(repoRoot));
      if (result.ok) {
        setLastPulledChanges(repoRoot, result.data?.status === "pulled" ? result.data.files : []);
      }

      return toRepoOperationResult(
        "pull",
        repoRoot,
        result
      );
    },

    async pullAll(): Promise<BulkOperationResult> {
      return runBulkRepoOperation("pull", async (repoRoot) => this.pull(repoRoot));
    },

    async push(repoRoot: string): Promise<RepoOperationResult> {
      return toRepoOperationResult(
        "push",
        repoRoot,
        await runRepoMutation(repoRoot, () => gitService.push(repoRoot))
      );
    },

    async pushAll(): Promise<BulkOperationResult> {
      return runBulkRepoOperation("push", async (repoRoot) => this.push(repoRoot));
    },

    setCommitMessage(repoRoot: string, value: string): void {
      setState({
        ...state,
        repositories: state.repositories.map((repoState) =>
          repoState.repo.rootPath === repoRoot
            ? { ...repoState, commitMessage: value }
            : repoState
        )
      });
    },

    setRepoSelected(repoRoot: string, isSelected: boolean): void {
      setState({
        ...state,
        repositories: state.repositories.map((repoState) =>
          repoState.repo.rootPath === repoRoot
            ? { ...repoState, isSelected }
            : repoState
        )
      });
    },

    toggleRepoExpanded(repoRoot: string): void {
      setState({
        ...state,
        repositories: state.repositories.map((repoState) =>
          repoState.repo.rootPath === repoRoot
            ? { ...repoState, isExpanded: !repoState.isExpanded }
            : repoState
        )
      });
    }
  };
}

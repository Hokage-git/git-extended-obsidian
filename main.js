"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// main.ts
var main_exports = {};
__export(main_exports, {
  default: () => GitExtendedPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian3 = require("obsidian");

// src/controller/commit-message.ts
function pad(value) {
  return String(value).padStart(2, "0");
}
function createAutoCommitMessage(date) {
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `update: ${year}-${month}-${day} ${hours}:${minutes}`;
}

// src/controller/multi-repo-controller.ts
function createRepoState(repo) {
  return {
    repo,
    staged: [],
    unstaged: [],
    untracked: [],
    lastPulledChanges: [],
    commitMessage: "",
    isLoading: false,
    isBusy: false,
    isExpanded: false
  };
}
function hasVisibleChanges(status) {
  return status.staged.length > 0 || status.unstaged.length > 0 || status.untracked.length > 0;
}
function mergeStatus(repoState, status) {
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
    lastError: void 0
  };
}
function createMultiRepoController({
  discoverRepositories: discoverRepositories2,
  gitService,
  now = () => /* @__PURE__ */ new Date(),
  vaultPath
}) {
  let state = {
    gitAvailable: true,
    isLoading: false,
    repositories: []
  };
  const listeners = /* @__PURE__ */ new Set();
  function emit() {
    for (const listener of listeners) {
      listener(state);
    }
  }
  function setState(nextState) {
    state = nextState;
    emit();
  }
  async function refreshRepo(repoRoot) {
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
    repositories[repoIndex] = statusResult.ok && statusResult.data ? mergeStatus(
      {
        ...current,
        isBusy: false,
        isLoading: false
      },
      statusResult.data
    ) : {
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
  async function runRepoMutation(repoRoot, action) {
    const repoIndex = state.repositories.findIndex(
      (repoState) => repoState.repo.rootPath === repoRoot
    );
    if (repoIndex === -1) {
      return {
        ok: false,
        stdout: "",
        stderr: "Repository not found."
      };
    }
    const current = state.repositories[repoIndex];
    if (!current || current.isBusy) {
      return {
        ok: false,
        stdout: "",
        stderr: "Repository is busy."
      };
    }
    const repositories = [...state.repositories];
    repositories[repoIndex] = {
      ...current,
      isBusy: true,
      lastError: void 0
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
  function setLastPulledChanges(repoRoot, changes) {
    setState({
      ...state,
      repositories: state.repositories.map(
        (repoState) => repoState.repo.rootPath === repoRoot ? { ...repoState, lastPulledChanges: changes } : repoState
      )
    });
  }
  function toRepoOperationResult(operation, repoRoot, result) {
    const repoState = state.repositories.find((repo) => repo.repo.rootPath === repoRoot);
    return {
      operation,
      repoRoot,
      repoPath: repoState?.repo.relativePath || ".",
      ok: result.ok,
      status: !result.ok ? "failed" : operation === "pull" && result.data?.status === "upToDate" ? "upToDate" : operation === "pull" ? "pulled" : "completed",
      error: result.ok ? void 0 : result.stderr || "Git command failed."
    };
  }
  async function runBulkRepoOperation(operation, runner) {
    let successCount = 0;
    let failureCount = 0;
    const details = [];
    for (const repository of state.repositories) {
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
  async function stageAllFilesForRepo(repoRoot) {
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
      lastError: void 0
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
    subscribe(listener) {
      listeners.add(listener);
      listener(state);
      return () => {
        listeners.delete(listener);
      };
    },
    getState() {
      return state;
    },
    async load() {
      setState({
        ...state,
        isLoading: true,
        error: void 0
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
      const repoInfos = await discoverRepositories2(vaultPath);
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
    async refreshAll() {
      for (const repository of state.repositories) {
        await refreshRepo(repository.repo.rootPath);
      }
    },
    async refreshRepo(repoRoot) {
      await refreshRepo(repoRoot);
    },
    async stageAllInRepo(repoRoot) {
      await stageAllFilesForRepo(repoRoot);
    },
    async stageAll() {
      for (const repository of state.repositories) {
        await stageAllFilesForRepo(repository.repo.rootPath);
      }
    },
    async discardFile(repoRoot, filePath, tracked) {
      await runRepoMutation(
        repoRoot,
        () => gitService.discardFile(repoRoot, filePath, tracked)
      );
    },
    async discardRepo(repoRoot) {
      await runRepoMutation(repoRoot, () => gitService.discardRepo(repoRoot));
    },
    async discardAll() {
      for (const repository of state.repositories) {
        await runRepoMutation(
          repository.repo.rootPath,
          () => gitService.discardRepo(repository.repo.rootPath)
        );
      }
    },
    async stageFile(repoRoot, filePath) {
      await runRepoMutation(repoRoot, () => gitService.stageFile(repoRoot, filePath));
    },
    async unstageFile(repoRoot, filePath) {
      await runRepoMutation(repoRoot, () => gitService.unstageFile(repoRoot, filePath));
    },
    async commit(repoRoot) {
      const repo = state.repositories.find(
        (repoState) => repoState.repo.rootPath === repoRoot
      );
      if (!repo || repo.staged.length === 0) {
        return void 0;
      }
      const message = repo.commitMessage.trim() || createAutoCommitMessage(now());
      const result = await runRepoMutation(
        repoRoot,
        () => gitService.commit(repoRoot, message)
      );
      const repositories = state.repositories.map(
        (repoState) => repoState.repo.rootPath === repoRoot ? { ...repoState, commitMessage: repoState.lastError ? repoState.commitMessage : "" } : repoState
      );
      setState({ ...state, repositories });
      return result;
    },
    async pull(repoRoot) {
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
    async pullAll() {
      return runBulkRepoOperation("pull", async (repoRoot) => this.pull(repoRoot));
    },
    async push(repoRoot) {
      return toRepoOperationResult(
        "push",
        repoRoot,
        await runRepoMutation(repoRoot, () => gitService.push(repoRoot))
      );
    },
    async pushAll() {
      return runBulkRepoOperation("push", async (repoRoot) => this.push(repoRoot));
    },
    setCommitMessage(repoRoot, value) {
      setState({
        ...state,
        repositories: state.repositories.map(
          (repoState) => repoState.repo.rootPath === repoRoot ? { ...repoState, commitMessage: value } : repoState
        )
      });
    },
    toggleRepoExpanded(repoRoot) {
      setState({
        ...state,
        repositories: state.repositories.map(
          (repoState) => repoState.repo.rootPath === repoRoot ? { ...repoState, isExpanded: !repoState.isExpanded } : repoState
        )
      });
    }
  };
}

// src/discovery/repo-discovery-service.ts
var import_promises = require("node:fs/promises");
var import_node_path = __toESM(require("node:path"));
function toRelativeRepoInfo(vaultPath, repoRoot) {
  return {
    rootPath: repoRoot,
    relativePath: import_node_path.default.relative(vaultPath, repoRoot).split(import_node_path.default.sep).join("/"),
    branch: ""
  };
}
async function scanDirectory(currentPath, results) {
  const entries = await (0, import_promises.readdir)(currentPath, { withFileTypes: true });
  const hasGitDirectory = entries.some(
    (entry) => entry.isDirectory() && entry.name === ".git"
  );
  if (hasGitDirectory) {
    results.push(currentPath);
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === ".git") {
      continue;
    }
    await scanDirectory(import_node_path.default.join(currentPath, entry.name), results);
  }
}
async function discoverRepositories(vaultPath) {
  const repositories = [];
  await scanDirectory(vaultPath, repositories);
  return repositories.sort((left, right) => left.localeCompare(right)).map((repoRoot) => toRelativeRepoInfo(vaultPath, repoRoot));
}

// src/git/git-service.ts
var import_node_child_process = require("node:child_process");
var import_promises2 = require("node:fs/promises");
var import_node_path2 = __toESM(require("node:path"));
var import_node_util = require("node:util");

// src/git/status-parser.ts
var CONFLICT_CODES = /* @__PURE__ */ new Set(["DD", "AU", "UD", "UA", "DU", "AA", "UU"]);
function parseBranch(line) {
  return line.slice(3).trim().split("...")[0] ?? "";
}
function normalizePath(rawPath) {
  const renamedMarker = " -> ";
  if (rawPath.includes(renamedMarker)) {
    return rawPath.split(renamedMarker)[1] ?? rawPath;
  }
  return rawPath;
}
function toKind(code) {
  switch (code) {
    case "R":
      return "renamed";
    case "D":
      return "deleted";
    case "?":
      return "untracked";
    case "U":
      return "conflict";
    default:
      return "modified";
  }
}
function parseStatusPorcelain(output) {
  const snapshot = {
    branch: "",
    staged: [],
    unstaged: [],
    untracked: []
  };
  for (const line of output.split(/\r?\n/)) {
    if (!line) {
      continue;
    }
    if (line.startsWith("## ")) {
      snapshot.branch = parseBranch(line);
      continue;
    }
    const x = line[0] ?? " ";
    const y = line[1] ?? " ";
    const path3 = normalizePath(line.slice(3));
    const combined = `${x}${y}`;
    if (combined === "??") {
      snapshot.untracked.push({ kind: "untracked", path: path3, x, y });
      continue;
    }
    if (CONFLICT_CODES.has(combined)) {
      snapshot.unstaged.push({ kind: "conflict", path: path3, x, y });
      continue;
    }
    if (x !== " ") {
      snapshot.staged.push({ kind: toKind(x), path: path3, x, y });
    }
    if (y !== " ") {
      snapshot.unstaged.push({ kind: toKind(y), path: path3, x, y });
    }
  }
  return snapshot;
}

// src/git/git-service.ts
var execFileAsync = (0, import_node_util.promisify)(import_node_child_process.execFile);
async function defaultRunner(repoRoot, args) {
  try {
    const result = await execFileAsync("git", args, {
      cwd: repoRoot,
      windowsHide: true
    });
    return {
      exitCode: 0,
      stderr: result.stderr,
      stdout: result.stdout
    };
  } catch (error) {
    const gitError = error;
    return {
      exitCode: gitError.code ?? 1,
      stderr: gitError.stderr ?? "",
      stdout: gitError.stdout ?? ""
    };
  }
}
function toCommandResult(runResult, data) {
  return {
    ok: runResult.exitCode === 0,
    stdout: runResult.stdout,
    stderr: runResult.stderr,
    data
  };
}
function withDefaultGitConfig(args) {
  return ["-c", "core.quotepath=false", ...args];
}
function parsePullNameStatus(output) {
  const changes = [];
  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/^([AMD])\t(.+)$/);
    if (!match) {
      continue;
    }
    const [, status, filePath] = match;
    const kind = status === "A" ? "new" : status === "M" ? "updated" : "deleted";
    changes.push({ path: filePath, kind });
  }
  return changes;
}
function createGitService(runner = defaultRunner, dependencies = {}) {
  const deletePath = dependencies.deletePath ?? ((targetPath) => (0, import_promises2.rm)(targetPath, { force: true, recursive: true }));
  return {
    async checkGitAvailability() {
      const result = await runner(process.cwd(), withDefaultGitConfig(["--version"]));
      return result.exitCode === 0;
    },
    async getStatus(repoRoot) {
      const result = await runner(
        repoRoot,
        withDefaultGitConfig(["status", "--porcelain=v1", "-b"])
      );
      return toCommandResult(
        result,
        result.exitCode === 0 ? parseStatusPorcelain(result.stdout) : void 0
      );
    },
    async stageFile(repoRoot, filePath) {
      return toCommandResult(
        await runner(repoRoot, withDefaultGitConfig(["add", "--", filePath]))
      );
    },
    async unstageFile(repoRoot, filePath) {
      return toCommandResult(
        await runner(
          repoRoot,
          withDefaultGitConfig(["restore", "--staged", "--", filePath])
        )
      );
    },
    async commit(repoRoot, message) {
      return toCommandResult(
        await runner(repoRoot, withDefaultGitConfig(["commit", "-m", message]))
      );
    },
    async pull(repoRoot) {
      const fetchResult = await runner(repoRoot, withDefaultGitConfig(["fetch", "--quiet"]));
      if (fetchResult.exitCode !== 0) {
        return toCommandResult(fetchResult);
      }
      const headResult = await runner(repoRoot, withDefaultGitConfig(["rev-parse", "HEAD"]));
      if (headResult.exitCode !== 0) {
        return toCommandResult(headResult);
      }
      const upstreamResult = await runner(repoRoot, withDefaultGitConfig(["rev-parse", "@{u}"]));
      if (upstreamResult.exitCode !== 0) {
        return toCommandResult(upstreamResult);
      }
      if (headResult.stdout.trim() === upstreamResult.stdout.trim()) {
        return {
          ok: true,
          stdout: fetchResult.stdout,
          stderr: "",
          data: {
            status: "upToDate",
            files: []
          }
        };
      }
      const pullResult = await runner(repoRoot, withDefaultGitConfig(["pull", "--name-status"]));
      return toCommandResult(pullResult, {
        status: "pulled",
        files: pullResult.exitCode === 0 ? parsePullNameStatus(pullResult.stdout) : []
      });
    },
    async push(repoRoot) {
      return toCommandResult(await runner(repoRoot, withDefaultGitConfig(["push"])));
    },
    async discardFile(repoRoot, filePath, tracked) {
      if (!tracked) {
        try {
          await deletePath(import_node_path2.default.join(repoRoot, filePath));
          return {
            ok: true,
            stdout: "",
            stderr: ""
          };
        } catch (error) {
          return {
            ok: false,
            stdout: "",
            stderr: error instanceof Error ? error.message : String(error)
          };
        }
      }
      return toCommandResult(
        await runner(
          repoRoot,
          withDefaultGitConfig(["restore", "--staged", "--worktree", "--", filePath])
        )
      );
    },
    async discardRepo(repoRoot) {
      const resetResult = await runner(
        repoRoot,
        withDefaultGitConfig(["reset", "--hard", "HEAD"])
      );
      if (resetResult.exitCode !== 0) {
        return toCommandResult(resetResult);
      }
      const cleanResult = await runner(repoRoot, withDefaultGitConfig(["clean", "-fd"]));
      return {
        ok: cleanResult.exitCode === 0,
        stdout: [resetResult.stdout, cleanResult.stdout].filter(Boolean).join("\n"),
        stderr: [resetResult.stderr, cleanResult.stderr].filter(Boolean).join("\n")
      };
    }
  };
}

// src/ui/multi-repo-view.ts
var import_obsidian2 = require("obsidian");

// src/ui/repo-view-model.ts
function getCommitPlaceholder(repoState) {
  if (repoState.staged.length === 0) {
    return "Stage files to create a commit";
  }
  const segments = repoState.repo.relativePath.split("/").filter(Boolean);
  const repoName = segments.at(-1) ?? repoState.repo.relativePath ?? "repo";
  return `Commit staged changes in ${repoName}`;
}
function getChangeBadge(kind) {
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
function shouldShowCleanState(repoState) {
  return repoState.staged.length === 0 && repoState.unstaged.length === 0 && repoState.untracked.length === 0;
}
function getRepoSummaryItems(repoState) {
  return [
    { label: "S", value: repoState.staged.length },
    { label: "C", value: repoState.unstaged.length },
    { label: "U", value: repoState.untracked.length }
  ];
}
function getGlobalSummaryItems(repositories) {
  return repositories.reduce(
    (items, repoState) => [
      { label: "S", value: items[0].value + repoState.staged.length },
      { label: "C", value: items[1].value + repoState.unstaged.length },
      { label: "U", value: items[2].value + repoState.untracked.length }
    ],
    [
      { label: "S", value: 0 },
      { label: "C", value: 0 },
      { label: "U", value: 0 }
    ]
  );
}

// src/ui/confirm-modal.ts
var import_obsidian = require("obsidian");
var ConfirmModal = class extends import_obsidian.Modal {
  constructor(app, title, message, confirmLabel = "Confirm") {
    super(app);
    this.title = title;
    this.message = message;
    this.confirmLabel = confirmLabel;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h3", { text: this.title });
    contentEl.createEl("p", { text: this.message });
    new import_obsidian.Setting(contentEl).addButton(
      (button) => button.setButtonText("Cancel").onClick(() => {
        this.closeWith(false);
      })
    ).addButton(
      (button) => button.setWarning().setButtonText(this.confirmLabel).onClick(() => {
        this.closeWith(true);
      })
    );
  }
  onClose() {
    this.contentEl.empty();
    this.closeWith(false, false);
  }
  waitForDecision() {
    return new Promise((resolve) => {
      this.resolver = resolve;
      this.open();
    });
  }
  closeWith(value, shouldClose = true) {
    const resolve = this.resolver;
    this.resolver = void 0;
    resolve?.(value);
    if (shouldClose) {
      this.close();
    }
  }
};

// src/ui/confirm-labels.ts
function getConfirmActionLabel(action) {
  switch (action) {
    case "pull":
      return "Pull";
    case "stage":
      return "Stage";
    default:
      return "Discard";
  }
}

// src/ui/operation-notices.ts
function toPastTense(operation) {
  return operation === "pull" ? "Pulled" : "Pushed";
}
function toRepoOutcomeLabel(status) {
  switch (status) {
    case "upToDate":
      return "already up to date";
    case "pulled":
      return "pulled";
    case "completed":
      return "completed";
    default:
      return "failed";
  }
}
function formatRepoOperationNotice(operation, repoPath, success, error, status = success ? "completed" : "failed") {
  if (operation === "pull" && status === "upToDate") {
    return `${repoPath} is already up to date`;
  }
  if (success) {
    return `${toPastTense(operation)} ${repoPath}`;
  }
  return `${operation === "pull" ? "Pull" : "Push"} failed for ${repoPath}: ${error ?? "Git command failed"}`;
}
function formatBulkOperationNotice(operation, successCount, failureCount) {
  const base = `${toPastTense(operation)} ${successCount} repositories`;
  return failureCount > 0 ? `${base}, ${failureCount} failed` : base;
}
function formatDetailedBulkOperationNotice(operation, details) {
  return details.map((detail) => {
    const repoPath = detail.repoPath || detail.repoRoot;
    if (!detail.ok) {
      return `${repoPath}: failed: ${detail.error ?? "Git command failed"}`;
    }
    if (operation === "pull") {
      return `${repoPath}: ${toRepoOutcomeLabel(detail.status)}`;
    }
    return `${repoPath}: ${toPastTense(operation).toLowerCase()}`;
  }).join("\n");
}

// src/ui/error-visibility.ts
function syncDismissibleErrorState(current, message) {
  if (!message) {
    return void 0;
  }
  if (!current || current.message !== message) {
    return {
      message,
      dismissed: false
    };
  }
  return current;
}

// src/ui/repo-actions.ts
var GLOBAL_REPO_ACTIONS = [
  "refresh",
  "stageAll",
  "pull",
  "push",
  "discard"
];
var REPO_ACTIONS = [
  "refresh",
  "stageAll",
  "pull",
  "push",
  "discard"
];
var ACTION_ICONS = {
  refresh: "refresh-cw",
  stageAll: "plus",
  pull: "download",
  push: "upload",
  discard: "trash-2"
};
function getActionIcon(action) {
  return ACTION_ICONS[action];
}

// src/ui/multi-repo-view.ts
var MULTI_REPO_VIEW_TYPE = "multi-repo-git-view";
var AUTO_REFRESH_INTERVAL_MS = 6e4;
var ERROR_AUTO_DISMISS_MS = 2e4;
function createIconButton(parent, icon, label, disabled, onClick) {
  const button = parent.createEl("button", {
    cls: "git-extended__icon-button"
  });
  button.ariaLabel = label;
  button.disabled = disabled;
  (0, import_obsidian2.setIcon)(button, icon);
  button.addEventListener("click", async (event) => {
    event.stopPropagation();
    await onClick(event);
  });
  return button;
}
function createActionButton(parent, label, disabled, onClick) {
  const button = parent.createEl("button", {
    cls: "git-extended__button",
    text: label
  });
  button.disabled = disabled;
  button.addEventListener("click", async () => {
    await onClick();
  });
  return button;
}
function renderFileList(view, container, title, files, actionLabel, isBusy, tracked, onAction, onDiscard) {
  const section = container.createDiv("git-extended__section");
  section.createEl("div", {
    cls: "git-extended__section-title",
    text: `${title} (${files.length})`
  });
  if (files.length === 0) {
    section.createDiv({
      cls: "git-extended__empty-hint",
      text: "No files"
    });
    return;
  }
  for (const file of files) {
    const row = section.createDiv("git-extended__file-row");
    const badge = getChangeBadge(file.kind);
    row.createDiv({
      cls: `git-extended__file-badge git-extended__file-badge--${badge.tone}`,
      text: badge.label
    });
    row.createDiv({
      cls: "git-extended__file-path",
      text: file.path
    });
    const actions = row.createDiv("git-extended__file-actions");
    createActionButton(actions, actionLabel, isBusy, () => onAction(file.path));
    createIconButton(
      actions,
      "trash-2",
      "Discard file",
      isBusy,
      () => onDiscard(file.path, tracked)
    ).addClass("mod-warning");
  }
}
function getPulledChangeBadge(change) {
  if (change.kind === "new") {
    return { label: "new", tone: "untracked" };
  }
  if (change.kind === "deleted") {
    return { label: "deleted", tone: "deleted" };
  }
  return { label: "updated", tone: "modified" };
}
function renderPulledFileList(container, title, files) {
  if (files.length === 0) {
    return;
  }
  const section = container.createDiv("git-extended__section");
  section.createEl("div", {
    cls: "git-extended__section-title",
    text: `${title} (${files.length})`
  });
  for (const file of files) {
    const row = section.createDiv("git-extended__file-row git-extended__file-row--static");
    const badge = getPulledChangeBadge(file);
    row.createDiv({
      cls: `git-extended__file-badge git-extended__file-badge--${badge.tone} git-extended__file-badge--wide`,
      text: badge.label
    });
    row.createDiv({
      cls: "git-extended__file-path",
      text: file.path
    });
  }
}
var MultiRepoView = class extends import_obsidian2.ItemView {
  constructor(leaf, controller) {
    super(leaf);
    this.controller = controller;
    this.isAutoRefreshing = false;
    this.repoErrorStates = /* @__PURE__ */ new Map();
    this.repoErrorTimers = /* @__PURE__ */ new Map();
  }
  getViewType() {
    return MULTI_REPO_VIEW_TYPE;
  }
  getDisplayText() {
    return "Multi Repo Git";
  }
  getIcon() {
    return "git-branch-plus";
  }
  async onOpen() {
    this.unsubscribe = this.controller.subscribe((state) => this.render(state));
    this.startAutoRefresh();
    await this.controller.load();
  }
  async onClose() {
    this.unsubscribe?.();
    if (this.autoRefreshTimer !== void 0) {
      window.clearInterval(this.autoRefreshTimer);
    }
    if (this.globalErrorTimer !== void 0) {
      window.clearTimeout(this.globalErrorTimer);
    }
    for (const timerId of this.repoErrorTimers.values()) {
      window.clearTimeout(timerId);
    }
    this.repoErrorTimers.clear();
  }
  scheduleGlobalErrorDismiss(message) {
    if (this.globalErrorTimer !== void 0) {
      window.clearTimeout(this.globalErrorTimer);
    }
    this.globalErrorTimer = window.setTimeout(() => {
      if (this.globalErrorState?.message !== message) {
        return;
      }
      this.globalErrorState = {
        ...this.globalErrorState,
        dismissed: true
      };
      this.render(this.controller.getState());
    }, ERROR_AUTO_DISMISS_MS);
  }
  scheduleRepoErrorDismiss(repoRoot, message) {
    const existingTimer = this.repoErrorTimers.get(repoRoot);
    if (existingTimer !== void 0) {
      window.clearTimeout(existingTimer);
    }
    const timerId = window.setTimeout(() => {
      const errorState = this.repoErrorStates.get(repoRoot);
      if (!errorState || errorState.message !== message) {
        return;
      }
      this.repoErrorStates.set(repoRoot, {
        ...errorState,
        dismissed: true
      });
      this.render(this.controller.getState());
    }, ERROR_AUTO_DISMISS_MS);
    this.repoErrorTimers.set(repoRoot, timerId);
  }
  syncErrorVisibility(state) {
    const nextGlobal = syncDismissibleErrorState(this.globalErrorState, state.error);
    if (nextGlobal?.message !== this.globalErrorState?.message && nextGlobal) {
      this.scheduleGlobalErrorDismiss(nextGlobal.message);
    }
    this.globalErrorState = nextGlobal;
    if (!state.error && this.globalErrorTimer !== void 0) {
      window.clearTimeout(this.globalErrorTimer);
      this.globalErrorTimer = void 0;
    }
    const activeRepoRoots = /* @__PURE__ */ new Set();
    for (const repoState of state.repositories) {
      const nextRepoError = syncDismissibleErrorState(
        this.repoErrorStates.get(repoState.repo.rootPath),
        repoState.lastError
      );
      const previousRepoError = this.repoErrorStates.get(repoState.repo.rootPath);
      if (nextRepoError?.message !== previousRepoError?.message && nextRepoError) {
        this.scheduleRepoErrorDismiss(repoState.repo.rootPath, nextRepoError.message);
      }
      if (nextRepoError) {
        this.repoErrorStates.set(repoState.repo.rootPath, nextRepoError);
        activeRepoRoots.add(repoState.repo.rootPath);
      } else {
        const timerId = this.repoErrorTimers.get(repoState.repo.rootPath);
        if (timerId !== void 0) {
          window.clearTimeout(timerId);
          this.repoErrorTimers.delete(repoState.repo.rootPath);
        }
        this.repoErrorStates.delete(repoState.repo.rootPath);
      }
    }
    for (const repoRoot of [...this.repoErrorStates.keys()]) {
      if (activeRepoRoots.has(repoRoot)) {
        continue;
      }
      const timerId = this.repoErrorTimers.get(repoRoot);
      if (timerId !== void 0) {
        window.clearTimeout(timerId);
        this.repoErrorTimers.delete(repoRoot);
      }
      this.repoErrorStates.delete(repoRoot);
    }
  }
  dismissGlobalError() {
    if (!this.globalErrorState) {
      return;
    }
    this.globalErrorState = {
      ...this.globalErrorState,
      dismissed: true
    };
    this.render(this.controller.getState());
  }
  dismissRepoError(repoRoot) {
    const errorState = this.repoErrorStates.get(repoRoot);
    if (!errorState) {
      return;
    }
    this.repoErrorStates.set(repoRoot, {
      ...errorState,
      dismissed: true
    });
    this.render(this.controller.getState());
  }
  renderErrorBanner(parent, cls, message, onDismiss) {
    const banner = parent.createDiv(cls);
    banner.createDiv({
      cls: "git-extended__error-text",
      text: message
    });
    createIconButton(banner, "x", "Dismiss error", false, () => onDismiss()).addClass(
      "git-extended__error-dismiss"
    );
  }
  async confirmDiscard(title, message, action, onConfirm) {
    const confirmed = await new ConfirmModal(
      this.app,
      title,
      message,
      getConfirmActionLabel(action)
    ).waitForDecision();
    if (!confirmed) {
      return;
    }
    await onConfirm();
  }
  startAutoRefresh() {
    this.autoRefreshTimer = window.setInterval(async () => {
      if (this.isAutoRefreshing) {
        return;
      }
      const state = this.controller.getState();
      if (state.isLoading || !state.gitAvailable || state.repositories.length === 0 || state.repositories.some((repoState) => repoState.isBusy)) {
        return;
      }
      this.isAutoRefreshing = true;
      try {
        await this.controller.refreshAll();
      } finally {
        this.isAutoRefreshing = false;
      }
    }, AUTO_REFRESH_INTERVAL_MS);
  }
  showRepoOperationNotice(result) {
    new import_obsidian2.Notice(
      formatRepoOperationNotice(
        result.operation,
        result.repoPath || ".",
        result.ok,
        result.error,
        result.status
      )
    );
  }
  showBulkOperationNotice(result) {
    if (result.operation === "pull") {
      new import_obsidian2.Notice(formatDetailedBulkOperationNotice("pull", result.details), 8e3);
      return;
    }
    new import_obsidian2.Notice(
      formatBulkOperationNotice(
        result.operation,
        result.successCount,
        result.failureCount
      )
    );
  }
  showCommitNotice(repoRoot, result) {
    if (!result) {
      return;
    }
    const repoState = this.controller.getState().repositories.find((repo) => repo.repo.rootPath === repoRoot);
    const repoPath = repoState?.repo.relativePath || ".";
    new import_obsidian2.Notice(result.ok ? `Committed ${repoPath}` : `Commit failed for ${repoPath}: ${result.stderr}`);
  }
  captureCommitInputState() {
    const activeElement = document.activeElement;
    if (!(activeElement instanceof HTMLInputElement)) {
      this.commitInputState = void 0;
      return;
    }
    const repoRoot = activeElement.dataset.repoRoot;
    if (!repoRoot) {
      this.commitInputState = void 0;
      return;
    }
    this.commitInputState = {
      repoRoot,
      selectionEnd: activeElement.selectionEnd,
      selectionStart: activeElement.selectionStart
    };
  }
  restoreCommitInputState(inputEl, repoRoot) {
    if (!this.commitInputState || this.commitInputState.repoRoot !== repoRoot) {
      return;
    }
    inputEl.focus();
    if (this.commitInputState.selectionStart !== null && this.commitInputState.selectionEnd !== null) {
      inputEl.setSelectionRange(
        this.commitInputState.selectionStart,
        this.commitInputState.selectionEnd
      );
    }
    this.commitInputState = void 0;
  }
  createHeaderAction(parent, action, state) {
    const handlers = {
      refresh: async () => {
        await this.controller.refreshAll();
      },
      stageAll: async () => {
        await this.confirmDiscard(
          "Stage all repository changes?",
          "This will stage all unstaged and untracked files across every discovered repository.",
          "stage",
          () => this.controller.stageAll()
        );
      },
      pull: async () => {
        await this.confirmDiscard(
          "Pull all repositories?",
          "This will run pull in every discovered repository one by one.",
          "pull",
          async () => {
            this.showBulkOperationNotice(await this.controller.pullAll());
          }
        );
      },
      push: async () => {
        this.showBulkOperationNotice(await this.controller.pushAll());
      },
      discard: async () => {
        await this.confirmDiscard(
          "Discard all repository changes?",
          "This will reset every discovered repository back to its current HEAD and remove untracked files.",
          "discard",
          () => this.controller.discardAll()
        );
      }
    };
    const labels = {
      refresh: "Refresh all repositories",
      stageAll: "Stage all repositories",
      pull: "Pull all repositories",
      push: "Push all repositories",
      discard: "Discard all repositories"
    };
    const button = createIconButton(
      parent,
      getActionIcon(action),
      labels[action],
      state.isLoading,
      async () => {
        try {
          await handlers[action]();
        } catch (error) {
          new import_obsidian2.Notice(`${labels[action]} failed: ${String(error)}`);
        }
      }
    );
    if (action === "discard") {
      button.addClass("mod-warning");
    }
  }
  createRepoHeaderAction(parent, action, state) {
    const repoRoot = state.repo.rootPath;
    const labels = {
      refresh: "Refresh repository",
      stageAll: "Stage all files in repository",
      pull: "Pull repository",
      push: "Push repository",
      discard: "Discard repository"
    };
    const handlers = {
      refresh: async () => {
        await this.controller.refreshRepo(repoRoot);
      },
      stageAll: async () => {
        await this.controller.stageAllInRepo(repoRoot);
      },
      pull: async () => {
        this.showRepoOperationNotice(await this.controller.pull(repoRoot));
      },
      push: async () => {
        this.showRepoOperationNotice(await this.controller.push(repoRoot));
      },
      discard: async () => {
        await this.confirmDiscard(
          `Discard changes in ${state.repo.relativePath || "."}?`,
          "This will reset the repository to HEAD and remove untracked files.",
          "discard",
          () => this.controller.discardRepo(repoRoot)
        );
      }
    };
    const button = createIconButton(
      parent,
      getActionIcon(action),
      labels[action],
      state.isBusy,
      async () => {
        await handlers[action]();
      }
    );
    if (action === "discard") {
      button.addClass("mod-warning");
    }
    button.addEventListener("click", (event) => event.stopPropagation());
  }
  render(state) {
    const { contentEl } = this;
    this.captureCommitInputState();
    this.syncErrorVisibility(state);
    contentEl.empty();
    contentEl.addClass("git-extended");
    const header = contentEl.createDiv("git-extended__header");
    const headerTopRow = header.createDiv("git-extended__header-top-row");
    const titleGroup = headerTopRow.createDiv("git-extended__header-title-group");
    titleGroup.createEl("h2", {
      cls: "git-extended__title",
      text: "Multi Repo Git"
    });
    const headerActions = header.createDiv("git-extended__header-actions");
    for (const action of GLOBAL_REPO_ACTIONS) {
      this.createHeaderAction(headerActions, action, state);
    }
    const headerSummary = header.createDiv(
      "git-extended__repo-summary git-extended__repo-summary--header"
    );
    for (const item of getGlobalSummaryItems(state.repositories)) {
      const chip = headerSummary.createDiv("git-extended__summary-chip");
      chip.createSpan({ cls: "git-extended__summary-chip-label", text: item.label });
      chip.createSpan({ cls: "git-extended__summary-chip-value", text: String(item.value) });
    }
    if (!state.gitAvailable) {
      this.renderErrorBanner(
        contentEl,
        "git-extended__global-error",
        state.error ?? "Git binary not available.",
        () => this.dismissGlobalError()
      );
      return;
    }
    if (this.globalErrorState && !this.globalErrorState.dismissed) {
      this.renderErrorBanner(
        contentEl,
        "git-extended__global-error",
        this.globalErrorState.message,
        () => this.dismissGlobalError()
      );
    }
    if (state.repositories.length === 0) {
      contentEl.createDiv({
        cls: "git-extended__empty-state",
        text: state.isLoading ? "Scanning vault for nested repositories..." : "No nested Git repositories found in this vault."
      });
      return;
    }
    for (const repoState of state.repositories) {
      const card = contentEl.createDiv("git-extended__repo-card");
      const cardHeader = card.createDiv("git-extended__repo-header");
      cardHeader.addEventListener("click", () => {
        this.controller.toggleRepoExpanded(repoState.repo.rootPath);
      });
      const headerTopRow2 = cardHeader.createDiv("git-extended__repo-header-top-row");
      const headerMain = headerTopRow2.createDiv("git-extended__repo-header-main");
      headerMain.createDiv({
        cls: "git-extended__repo-toggle",
        text: repoState.isExpanded ? "\u25BE" : "\u25B8"
      });
      const repoMeta = headerMain.createDiv("git-extended__repo-meta");
      repoMeta.createDiv({
        cls: "git-extended__repo-path",
        text: repoState.repo.relativePath || "."
      });
      repoMeta.createDiv({
        cls: "git-extended__repo-branch",
        text: repoState.repo.branch || "unknown branch"
      });
      const headerActions2 = headerTopRow2.createDiv("git-extended__repo-header-actions");
      for (const action of REPO_ACTIONS) {
        this.createRepoHeaderAction(headerActions2, action, repoState);
      }
      const summary = cardHeader.createDiv(
        "git-extended__repo-summary git-extended__repo-summary--repo"
      );
      for (const item of getRepoSummaryItems(repoState)) {
        const chip = summary.createDiv("git-extended__summary-chip");
        chip.createSpan({ cls: "git-extended__summary-chip-label", text: item.label });
        chip.createSpan({ cls: "git-extended__summary-chip-value", text: String(item.value) });
      }
      const repoErrorState = this.repoErrorStates.get(repoState.repo.rootPath);
      if (repoErrorState && !repoErrorState.dismissed) {
        this.renderErrorBanner(
          card,
          "git-extended__repo-error",
          repoErrorState.message,
          () => this.dismissRepoError(repoState.repo.rootPath)
        );
      }
      if (!repoState.isExpanded) {
        continue;
      }
      if (shouldShowCleanState(repoState)) {
        card.createDiv({
          cls: "git-extended__clean-state",
          text: "Clean working tree"
        });
      } else {
        renderFileList(
          this,
          card,
          "Staged",
          repoState.staged,
          "Unstage",
          repoState.isBusy,
          true,
          (filePath) => this.controller.unstageFile(repoState.repo.rootPath, filePath),
          (filePath, tracked) => this.confirmDiscard(
            `Discard ${filePath}?`,
            "This will restore the file to HEAD and remove any local changes.",
            "discard",
            () => this.controller.discardFile(repoState.repo.rootPath, filePath, tracked)
          )
        );
        renderFileList(
          this,
          card,
          "Changes",
          repoState.unstaged,
          "Stage",
          repoState.isBusy,
          true,
          (filePath) => this.controller.stageFile(repoState.repo.rootPath, filePath),
          (filePath, tracked) => this.confirmDiscard(
            `Discard ${filePath}?`,
            "This will restore the file to HEAD and remove any local changes.",
            "discard",
            () => this.controller.discardFile(repoState.repo.rootPath, filePath, tracked)
          )
        );
        renderFileList(
          this,
          card,
          "Untracked",
          repoState.untracked,
          "Stage",
          repoState.isBusy,
          false,
          (filePath) => this.controller.stageFile(repoState.repo.rootPath, filePath),
          (filePath, tracked) => this.confirmDiscard(
            `Discard ${filePath}?`,
            "This will permanently remove the untracked file from disk.",
            "discard",
            () => this.controller.discardFile(repoState.repo.rootPath, filePath, tracked)
          )
        );
      }
      renderPulledFileList(card, "Pulled changes", repoState.lastPulledChanges);
      new import_obsidian2.Setting(card).setClass("git-extended__commit-setting").setName("Commit message").addText((text) => {
        text.inputEl.dataset.repoRoot = repoState.repo.rootPath;
        text.setPlaceholder(getCommitPlaceholder(repoState)).setValue(repoState.commitMessage).onChange((value) => {
          this.controller.setCommitMessage(repoState.repo.rootPath, value);
        });
        text.inputEl.disabled = repoState.isBusy;
        this.restoreCommitInputState(text.inputEl, repoState.repo.rootPath);
      });
      const actions = card.createDiv("git-extended__actions");
      createIconButton(actions, "check", "Commit repository", repoState.isBusy, async () => {
        this.showCommitNotice(
          repoState.repo.rootPath,
          await this.controller.commit(repoState.repo.rootPath)
        );
      }).disabled = repoState.isBusy || repoState.staged.length === 0;
    }
  }
};

// main.ts
var GitExtendedPlugin = class extends import_obsidian3.Plugin {
  async onload() {
    const vaultPath = this.getVaultPath();
    this.registerView(MULTI_REPO_VIEW_TYPE, (leaf) => {
      const controller = createMultiRepoController({
        discoverRepositories,
        gitService: createGitService(),
        vaultPath
      });
      return new MultiRepoView(leaf, controller);
    });
    this.addCommand({
      id: "open-multi-repo-git",
      name: "Open Multi Repo Git",
      callback: async () => {
        await this.activateView();
      }
    });
    this.addCommand({
      id: "refresh-multi-repo-git",
      name: "Refresh Multi Repo Git",
      callback: async () => {
        await this.activateView();
      }
    });
  }
  async onunload() {
    await this.app.workspace.detachLeavesOfType(MULTI_REPO_VIEW_TYPE);
  }
  getVaultPath() {
    const adapter = this.app.vault.adapter;
    if (!(adapter instanceof import_obsidian3.FileSystemAdapter)) {
      throw new Error("Git Extended works only with desktop vaults.");
    }
    return adapter.getBasePath();
  }
  async activateView() {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(MULTI_REPO_VIEW_TYPE)[0];
    if (!leaf) {
      leaf = workspace.getRightLeaf(false);
      await leaf.setViewState({
        type: MULTI_REPO_VIEW_TYPE,
        active: true
      });
    }
    workspace.revealLeaf(leaf);
  }
};

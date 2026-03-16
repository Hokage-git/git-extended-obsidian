import { ItemView, Notice, Setting, setIcon, type WorkspaceLeaf } from "obsidian";

import type {
  BulkOperationResult,
  ControllerState,
  GitCommandResult,
  RepoFileChange,
  RepoOperationResult
} from "../types";
import {
  getChangeBadge,
  getCommitPlaceholder,
  getGlobalSummaryItems,
  getRepoSummaryItems,
  shouldShowCleanState
} from "./repo-view-model";
import { ConfirmModal } from "./confirm-modal";
import { getConfirmActionLabel, type ConfirmActionKind } from "./confirm-labels";
import {
  formatBulkOperationNotice,
  formatDetailedBulkOperationNotice,
  formatRepoOperationNotice
} from "./operation-notices";
import {
  getActionIcon,
  GLOBAL_REPO_ACTIONS,
  REPO_ACTIONS,
  type RepoActionId
} from "./repo-actions";

type MultiRepoController = {
  subscribe(listener: (state: ControllerState) => void): () => void;
  getState(): ControllerState;
  load(): Promise<void>;
  refreshAll(): Promise<void>;
  refreshRepo(repoRoot: string): Promise<void>;
  stageAll(): Promise<void>;
  pullAll(): Promise<BulkOperationResult>;
  pushAll(): Promise<BulkOperationResult>;
  discardAll(): Promise<void>;
  stageAllInRepo(repoRoot: string): Promise<void>;
  stageFile(repoRoot: string, filePath: string): Promise<void>;
  unstageFile(repoRoot: string, filePath: string): Promise<void>;
  discardFile(repoRoot: string, filePath: string, tracked: boolean): Promise<void>;
  discardRepo(repoRoot: string): Promise<void>;
  commit(repoRoot: string): Promise<GitCommandResult | undefined>;
  pull(repoRoot: string): Promise<RepoOperationResult>;
  push(repoRoot: string): Promise<RepoOperationResult>;
  setCommitMessage(repoRoot: string, value: string): void;
  toggleRepoExpanded(repoRoot: string): void;
};

export const MULTI_REPO_VIEW_TYPE = "multi-repo-git-view";
const AUTO_REFRESH_INTERVAL_MS = 60_000;

function createIconButton(
  parent: HTMLElement,
  icon: string,
  label: string,
  disabled: boolean,
  onClick: (event: MouseEvent) => Promise<void> | void
): HTMLButtonElement {
  const button = parent.createEl("button", {
    cls: "git-extended__icon-button"
  });
  button.ariaLabel = label;
  button.disabled = disabled;
  setIcon(button, icon);
  button.addEventListener("click", async (event) => {
    event.stopPropagation();
    await onClick(event);
  });
  return button;
}

function createActionButton(
  parent: HTMLElement,
  label: string,
  disabled: boolean,
  onClick: () => Promise<void> | void
): HTMLButtonElement {
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

function renderFileList(
  view: MultiRepoView,
  container: HTMLElement,
  title: string,
  files: RepoFileChange[],
  actionLabel: string,
  isBusy: boolean,
  tracked: boolean,
  onAction: (filePath: string) => Promise<void>,
  onDiscard: (filePath: string, tracked: boolean) => Promise<void>
): void {
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
    createIconButton(actions, "trash-2", "Discard file", isBusy, () =>
      onDiscard(file.path, tracked)
    ).addClass("mod-warning");
  }
}

export class MultiRepoView extends ItemView {
  private unsubscribe?: () => void;
  private autoRefreshTimer?: number;
  private isAutoRefreshing = false;
  private commitInputState?: {
    repoRoot: string;
    selectionEnd: number | null;
    selectionStart: number | null;
  };

  constructor(
    leaf: WorkspaceLeaf,
    private readonly controller: MultiRepoController
  ) {
    super(leaf);
  }

  getViewType(): string {
    return MULTI_REPO_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "Multi Repo Git";
  }

  getIcon(): string {
    return "git-branch-plus";
  }

  async onOpen(): Promise<void> {
    this.unsubscribe = this.controller.subscribe((state) => this.render(state));
    this.startAutoRefresh();
    await this.controller.load();
  }

  async onClose(): Promise<void> {
    this.unsubscribe?.();
    if (this.autoRefreshTimer !== undefined) {
      window.clearInterval(this.autoRefreshTimer);
    }
  }

  private async confirmDiscard(
    title: string,
    message: string,
    action: ConfirmActionKind,
    onConfirm: () => Promise<void>
  ): Promise<void> {
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

  private startAutoRefresh(): void {
    this.autoRefreshTimer = window.setInterval(async () => {
      if (this.isAutoRefreshing) {
        return;
      }

      const state = this.controller.getState();
      if (
        state.isLoading ||
        !state.gitAvailable ||
        state.repositories.length === 0 ||
        state.repositories.some((repoState) => repoState.isBusy)
      ) {
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

  private showRepoOperationNotice(result: RepoOperationResult): void {
    new Notice(
      formatRepoOperationNotice(
        result.operation,
        result.repoPath || ".",
        result.ok,
        result.error,
        result.status
      )
    );
  }

  private showBulkOperationNotice(result: BulkOperationResult): void {
    if (result.operation === "pull") {
      new Notice(formatDetailedBulkOperationNotice("pull", result.details), 8000);
      return;
    }

    new Notice(
      formatBulkOperationNotice(
        result.operation,
        result.successCount,
        result.failureCount
      )
    );
  }

  private showCommitNotice(repoRoot: string, result?: GitCommandResult): void {
    if (!result) {
      return;
    }

    const repoState = this.controller
      .getState()
      .repositories.find((repo) => repo.repo.rootPath === repoRoot);
    const repoPath = repoState?.repo.relativePath || ".";
    new Notice(result.ok ? `Committed ${repoPath}` : `Commit failed for ${repoPath}: ${result.stderr}`);
  }

  private captureCommitInputState(): void {
    const activeElement = document.activeElement;
    if (!(activeElement instanceof HTMLInputElement)) {
      this.commitInputState = undefined;
      return;
    }

    const repoRoot = activeElement.dataset.repoRoot;
    if (!repoRoot) {
      this.commitInputState = undefined;
      return;
    }

    this.commitInputState = {
      repoRoot,
      selectionEnd: activeElement.selectionEnd,
      selectionStart: activeElement.selectionStart
    };
  }

  private restoreCommitInputState(inputEl: HTMLInputElement, repoRoot: string): void {
    if (!this.commitInputState || this.commitInputState.repoRoot !== repoRoot) {
      return;
    }

    inputEl.focus();
    if (
      this.commitInputState.selectionStart !== null &&
      this.commitInputState.selectionEnd !== null
    ) {
      inputEl.setSelectionRange(
        this.commitInputState.selectionStart,
        this.commitInputState.selectionEnd
      );
    }
    this.commitInputState = undefined;
  }

  private createHeaderAction(
    parent: HTMLElement,
    action: RepoActionId,
    state: ControllerState
  ): void {
    const handlers: Record<RepoActionId, () => Promise<void>> = {
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

    const labels: Record<RepoActionId, string> = {
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
          new Notice(`${labels[action]} failed: ${String(error)}`);
        }
      }
    );

    if (action === "discard") {
      button.addClass("mod-warning");
    }
  }

  private createRepoHeaderAction(
    parent: HTMLElement,
    action: RepoActionId,
    state: ControllerState["repositories"][number]
  ): void {
    const repoRoot = state.repo.rootPath;
    const labels: Record<RepoActionId, string> = {
      refresh: "Refresh repository",
      stageAll: "Stage all files in repository",
      pull: "Pull repository",
      push: "Push repository",
      discard: "Discard repository"
    };

    const handlers: Record<RepoActionId, () => Promise<void>> = {
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

  private render(state: ControllerState): void {
    const { contentEl } = this;
    this.captureCommitInputState();
    contentEl.empty();
    contentEl.addClass("git-extended");

    const header = contentEl.createDiv("git-extended__header");
    const headerTopRow = header.createDiv("git-extended__header-top-row");
    const titleGroup = headerTopRow.createDiv("git-extended__header-title-group");
    titleGroup.createEl("h2", {
      cls: "git-extended__title",
      text: "Multi Repo Git"
    });
    const headerSummary = headerTopRow.createDiv(
      "git-extended__repo-summary git-extended__repo-summary--header"
    );
    for (const item of getGlobalSummaryItems(state.repositories)) {
      const chip = headerSummary.createDiv("git-extended__summary-chip");
      chip.createSpan({ cls: "git-extended__summary-chip-label", text: item.label });
      chip.createSpan({ cls: "git-extended__summary-chip-value", text: String(item.value) });
    }

    const headerActions = header.createDiv("git-extended__header-actions");
    for (const action of GLOBAL_REPO_ACTIONS) {
      this.createHeaderAction(headerActions, action, state);
    }

    if (!state.gitAvailable) {
      contentEl.createDiv({
        cls: "git-extended__global-error",
        text: state.error ?? "Git binary not available."
      });
      return;
    }

    if (state.error) {
      contentEl.createDiv({
        cls: "git-extended__global-error",
        text: state.error
      });
    }

    if (state.repositories.length === 0) {
      contentEl.createDiv({
        cls: "git-extended__empty-state",
        text: state.isLoading
          ? "Scanning vault for nested repositories..."
          : "No nested Git repositories found in this vault."
      });
      return;
    }

    for (const repoState of state.repositories) {
      const card = contentEl.createDiv("git-extended__repo-card");
      const cardHeader = card.createDiv("git-extended__repo-header");
      cardHeader.addEventListener("click", () => {
        this.controller.toggleRepoExpanded(repoState.repo.rootPath);
      });
      const headerMain = cardHeader.createDiv("git-extended__repo-header-main");
      headerMain.createDiv({
        cls: "git-extended__repo-toggle",
        text: repoState.isExpanded ? "▾" : "▸"
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
      const summary = cardHeader.createDiv("git-extended__repo-summary");
      for (const item of getRepoSummaryItems(repoState)) {
        const chip = summary.createDiv("git-extended__summary-chip");
        chip.createSpan({ cls: "git-extended__summary-chip-label", text: item.label });
        chip.createSpan({ cls: "git-extended__summary-chip-value", text: String(item.value) });
      }
      const headerActions = cardHeader.createDiv("git-extended__repo-header-actions");
      for (const action of REPO_ACTIONS) {
        this.createRepoHeaderAction(headerActions, action, repoState);
      }

      if (repoState.lastError) {
        card.createDiv({
          cls: "git-extended__repo-error",
          text: repoState.lastError
        });
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
          (filePath) => this.controller.unstageFile(repoState.repo.rootPath, filePath)
          ,
          (filePath, tracked) =>
            this.confirmDiscard(
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
          (filePath) => this.controller.stageFile(repoState.repo.rootPath, filePath)
          ,
          (filePath, tracked) =>
            this.confirmDiscard(
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
          (filePath) => this.controller.stageFile(repoState.repo.rootPath, filePath)
          ,
          (filePath, tracked) =>
            this.confirmDiscard(
              `Discard ${filePath}?`,
              "This will permanently remove the untracked file from disk.",
              "discard",
              () => this.controller.discardFile(repoState.repo.rootPath, filePath, tracked)
            )
        );
      }

      new Setting(card)
        .setClass("git-extended__commit-setting")
        .setName("Commit message")
        .addText((text) => {
          text.inputEl.dataset.repoRoot = repoState.repo.rootPath;
          text
            .setPlaceholder(getCommitPlaceholder(repoState))
            .setValue(repoState.commitMessage)
            .onChange((value) => {
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
      }).disabled =
        repoState.isBusy || repoState.staged.length === 0;
    }
  }
}

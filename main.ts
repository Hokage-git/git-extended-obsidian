import { FileSystemAdapter, Plugin, WorkspaceLeaf } from "obsidian";

import { createMultiRepoController } from "./src/controller/multi-repo-controller";
import { discoverRepositories } from "./src/discovery/repo-discovery-service";
import { createGitService } from "./src/git/git-service";
import { MULTI_REPO_VIEW_TYPE, MultiRepoView } from "./src/ui/multi-repo-view";

export default class GitExtendedPlugin extends Plugin {
  async onload(): Promise<void> {
    const vaultPath = this.getVaultPath();

    this.registerView(MULTI_REPO_VIEW_TYPE, (leaf: WorkspaceLeaf) => {
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

  async onunload(): Promise<void> {
    await this.app.workspace.detachLeavesOfType(MULTI_REPO_VIEW_TYPE);
  }

  private getVaultPath(): string {
    const adapter = this.app.vault.adapter;

    if (!(adapter instanceof FileSystemAdapter)) {
      throw new Error("Git Extended works only with desktop vaults.");
    }

    return adapter.getBasePath();
  }

  private async activateView(): Promise<void> {
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
}

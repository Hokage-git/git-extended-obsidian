import { describe, expect, it, vi } from "vitest";

import { createMultiRepoController } from "../../src/controller/multi-repo-controller";
import type { GitCommandResult, RepoInfo, RepoStatusSnapshot } from "../../src/types";

function createStatus(branch: string): RepoStatusSnapshot {
  return {
    branch,
    staged: [],
    unstaged: [],
    untracked: []
  };
}

describe("multi repo controller refresh", () => {
  it("refreshes one repository on demand", async () => {
    const repositories: RepoInfo[] = [
      { branch: "", relativePath: "alpha", rootPath: "C:/vault/alpha" },
      { branch: "", relativePath: "beta", rootPath: "C:/vault/beta" }
    ];
    const getStatus = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        stdout: "",
        stderr: "",
        data: createStatus("main")
      } satisfies GitCommandResult<RepoStatusSnapshot>)
      .mockResolvedValueOnce({
        ok: true,
        stdout: "",
        stderr: "",
        data: createStatus("develop")
      } satisfies GitCommandResult<RepoStatusSnapshot>)
      .mockResolvedValueOnce({
        ok: true,
        stdout: "",
        stderr: "",
        data: createStatus("release")
      } satisfies GitCommandResult<RepoStatusSnapshot>);

    const controller = createMultiRepoController({
      discoverRepositories: vi.fn().mockResolvedValue(repositories),
      gitService: {
        checkGitAvailability: vi.fn().mockResolvedValue(true),
        commit: vi.fn(),
        discardFile: vi.fn(),
        discardRepo: vi.fn(),
        dropLocalCommit: vi.fn(),
        getStatus,
        pull: vi.fn(),
        push: vi.fn(),
        stageFile: vi.fn(),
        unstageFile: vi.fn()
      },
      vaultPath: "C:/vault"
    });

    await controller.load();
    await controller.refreshRepo("C:/vault/beta");

    expect(getStatus).toHaveBeenCalledTimes(3);
    expect(controller.getState().repositories.map((repo) => repo.repo.branch)).toEqual([
      "main",
      "release"
    ]);
  });
});

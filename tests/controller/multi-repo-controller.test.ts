import { describe, expect, it, vi } from "vitest";

import type { GitCommandResult, RepoInfo, RepoStatusSnapshot } from "../../src/types";
import { createMultiRepoController } from "../../src/controller/multi-repo-controller";

function createStatus(branch: string, stagedCount = 0): RepoStatusSnapshot {
  return {
    branch,
    staged: Array.from({ length: stagedCount }, (_, index) => ({
      kind: "modified",
      path: `file-${index}.ts`,
      x: "M",
      y: " "
    })),
    unstaged: [],
    untracked: []
  };
}

describe("createMultiRepoController", () => {
  it("loads all repositories and updates branch state", async () => {
    const repositories: RepoInfo[] = [
      { branch: "", relativePath: "alpha", rootPath: "C:/vault/alpha" },
      { branch: "", relativePath: "beta", rootPath: "C:/vault/beta" }
    ];
    const discoverRepositories = vi.fn().mockResolvedValue(repositories);
    const getStatus = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        stderr: "",
        stdout: "",
        data: createStatus("main", 1)
      } satisfies GitCommandResult<RepoStatusSnapshot>)
      .mockResolvedValueOnce({
        ok: true,
        stderr: "",
        stdout: "",
        data: createStatus("develop", 0)
      } satisfies GitCommandResult<RepoStatusSnapshot>);

    const controller = createMultiRepoController({
      discoverRepositories,
      gitService: {
        checkGitAvailability: vi.fn().mockResolvedValue(true),
        commit: vi.fn(),
        discardFile: vi.fn(),
        discardRepo: vi.fn(),
        getStatus,
        pull: vi.fn(),
        push: vi.fn(),
        stageFile: vi.fn(),
        unstageFile: vi.fn()
      },
      vaultPath: "C:/vault"
    });

    await controller.load();

    expect(discoverRepositories).toHaveBeenCalledWith("C:/vault");
    expect(controller.getState().repositories.map((repo) => repo.repo.branch)).toEqual([
      "main",
      "develop"
    ]);
    expect(controller.getState().repositories.map((repo) => repo.isExpanded)).toEqual([
      true,
      false
    ]);
  });

  it("refreshes only the affected repository after staging a file", async () => {
    const repositories: RepoInfo[] = [
      { branch: "", relativePath: "alpha", rootPath: "C:/vault/alpha" },
      { branch: "", relativePath: "beta", rootPath: "C:/vault/beta" }
    ];
    const getStatus = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        stderr: "",
        stdout: "",
        data: createStatus("main", 0)
      })
      .mockResolvedValueOnce({
        ok: true,
        stderr: "",
        stdout: "",
        data: createStatus("develop", 0)
      })
      .mockResolvedValueOnce({
        ok: true,
        stderr: "",
        stdout: "",
        data: createStatus("main", 1)
      });

    const stageFile = vi.fn().mockResolvedValue({
      ok: true,
      stderr: "",
      stdout: ""
    });

    const controller = createMultiRepoController({
      discoverRepositories: vi.fn().mockResolvedValue(repositories),
      gitService: {
        checkGitAvailability: vi.fn().mockResolvedValue(true),
        commit: vi.fn(),
        discardFile: vi.fn(),
        discardRepo: vi.fn(),
        getStatus,
        pull: vi.fn(),
        push: vi.fn(),
        stageFile,
        unstageFile: vi.fn()
      },
      vaultPath: "C:/vault"
    });

    await controller.load();
    await controller.stageFile("C:/vault/alpha", "tracked.ts");

    expect(stageFile).toHaveBeenCalledWith("C:/vault/alpha", "tracked.ts");
    expect(getStatus).toHaveBeenCalledTimes(3);
    expect(controller.getState().repositories[0]?.staged).toHaveLength(1);
    expect(controller.getState().repositories[1]?.repo.branch).toBe("develop");
  });

  it("toggles only the targeted repository expansion state", async () => {
    const repositories: RepoInfo[] = [
      { branch: "", relativePath: "alpha", rootPath: "C:/vault/alpha" },
      { branch: "", relativePath: "beta", rootPath: "C:/vault/beta" }
    ];

    const controller = createMultiRepoController({
      discoverRepositories: vi.fn().mockResolvedValue(repositories),
      gitService: {
        checkGitAvailability: vi.fn().mockResolvedValue(true),
        commit: vi.fn(),
        discardFile: vi.fn(),
        discardRepo: vi.fn(),
        getStatus: vi
          .fn()
          .mockResolvedValueOnce({
            ok: true,
            stderr: "",
            stdout: "",
            data: createStatus("main", 1)
          })
          .mockResolvedValueOnce({
            ok: true,
            stderr: "",
            stdout: "",
            data: createStatus("develop", 0)
          }),
        pull: vi.fn(),
        push: vi.fn(),
        stageFile: vi.fn(),
        unstageFile: vi.fn()
      },
      vaultPath: "C:/vault"
    });

    await controller.load();
    controller.toggleRepoExpanded("C:/vault/beta");

    expect(controller.getState().repositories.map((repo) => repo.isExpanded)).toEqual([
      true,
      true
    ]);
  });

  it("refreshes only the affected repository after discarding a file", async () => {
    const repositories: RepoInfo[] = [
      { branch: "", relativePath: "alpha", rootPath: "C:/vault/alpha" },
      { branch: "", relativePath: "beta", rootPath: "C:/vault/beta" }
    ];
    const getStatus = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        stderr: "",
        stdout: "",
        data: createStatus("main", 1)
      })
      .mockResolvedValueOnce({
        ok: true,
        stderr: "",
        stdout: "",
        data: createStatus("develop", 0)
      })
      .mockResolvedValueOnce({
        ok: true,
        stderr: "",
        stdout: "",
        data: createStatus("main", 0)
      });
    const discardFile = vi.fn().mockResolvedValue({
      ok: true,
      stderr: "",
      stdout: ""
    });

    const controller = createMultiRepoController({
      discoverRepositories: vi.fn().mockResolvedValue(repositories),
      gitService: {
        checkGitAvailability: vi.fn().mockResolvedValue(true),
        commit: vi.fn(),
        discardFile,
        discardRepo: vi.fn(),
        getStatus,
        pull: vi.fn(),
        push: vi.fn(),
        stageFile: vi.fn(),
        unstageFile: vi.fn()
      },
      vaultPath: "C:/vault"
    });

    await controller.load();
    await controller.discardFile("C:/vault/alpha", "tracked.ts", true);

    expect(discardFile).toHaveBeenCalledWith("C:/vault/alpha", "tracked.ts", true);
    expect(controller.getState().repositories[0]?.staged).toHaveLength(0);
    expect(controller.getState().repositories[1]?.repo.branch).toBe("develop");
  });

  it("discards all repositories sequentially", async () => {
    const repositories: RepoInfo[] = [
      { branch: "", relativePath: "alpha", rootPath: "C:/vault/alpha" },
      { branch: "", relativePath: "beta", rootPath: "C:/vault/beta" }
    ];
    const discardRepo = vi.fn().mockResolvedValue({
      ok: true,
      stderr: "",
      stdout: ""
    });
    const getStatus = vi.fn().mockResolvedValue({
      ok: true,
      stderr: "",
      stdout: "",
      data: createStatus("main", 0)
    });

    const controller = createMultiRepoController({
      discoverRepositories: vi.fn().mockResolvedValue(repositories),
      gitService: {
        checkGitAvailability: vi.fn().mockResolvedValue(true),
        commit: vi.fn(),
        discardFile: vi.fn(),
        discardRepo,
        getStatus,
        pull: vi.fn(),
        push: vi.fn(),
        stageFile: vi.fn(),
        unstageFile: vi.fn()
      },
      vaultPath: "C:/vault"
    });

    await controller.load();
    await controller.discardAll();

    expect(discardRepo).toHaveBeenNthCalledWith(1, "C:/vault/alpha");
    expect(discardRepo).toHaveBeenNthCalledWith(2, "C:/vault/beta");
  });

  it("stages all unstaged and untracked files in one repository and refreshes once", async () => {
    const repositories: RepoInfo[] = [
      { branch: "", relativePath: "alpha", rootPath: "C:/vault/alpha" }
    ];
    const getStatus = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        stderr: "",
        stdout: "",
        data: {
          branch: "main",
          staged: [],
          unstaged: [{ kind: "modified", path: "tracked.ts", x: " ", y: "M" }],
          untracked: [{ kind: "untracked", path: "draft.md", x: "?", y: "?" }]
        }
      })
      .mockResolvedValueOnce({
        ok: true,
        stderr: "",
        stdout: "",
        data: createStatus("main", 2)
      });
    const stageFile = vi.fn().mockResolvedValue({
      ok: true,
      stderr: "",
      stdout: ""
    });

    const controller = createMultiRepoController({
      discoverRepositories: vi.fn().mockResolvedValue(repositories),
      gitService: {
        checkGitAvailability: vi.fn().mockResolvedValue(true),
        commit: vi.fn(),
        discardFile: vi.fn(),
        discardRepo: vi.fn(),
        getStatus,
        pull: vi.fn(),
        push: vi.fn(),
        stageFile,
        unstageFile: vi.fn()
      },
      vaultPath: "C:/vault"
    });

    await controller.load();
    await controller.stageAllInRepo("C:/vault/alpha");

    expect(stageFile).toHaveBeenNthCalledWith(1, "C:/vault/alpha", "tracked.ts");
    expect(stageFile).toHaveBeenNthCalledWith(2, "C:/vault/alpha", "draft.md");
    expect(getStatus).toHaveBeenCalledTimes(2);
    expect(controller.getState().repositories[0]?.staged).toHaveLength(2);
  });

  it("runs stage all and pull all across every repository", async () => {
    const repositories: RepoInfo[] = [
      { branch: "", relativePath: "alpha", rootPath: "C:/vault/alpha" },
      { branch: "", relativePath: "beta", rootPath: "C:/vault/beta" }
    ];
    const getStatus = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        stderr: "",
        stdout: "",
        data: {
          branch: "main",
          staged: [],
          unstaged: [{ kind: "modified", path: "tracked.ts", x: " ", y: "M" }],
          untracked: []
        }
      })
      .mockResolvedValueOnce({
        ok: true,
        stderr: "",
        stdout: "",
        data: {
          branch: "develop",
          staged: [],
          unstaged: [],
          untracked: [{ kind: "untracked", path: "draft.md", x: "?", y: "?" }]
        }
      })
      .mockResolvedValue({
        ok: true,
        stderr: "",
        stdout: "",
        data: createStatus("main", 1)
      });
    const stageFile = vi.fn().mockResolvedValue({
      ok: true,
      stderr: "",
      stdout: ""
    });
    const pull = vi.fn().mockResolvedValue({
      ok: true,
      stderr: "",
      stdout: ""
    });

    const controller = createMultiRepoController({
      discoverRepositories: vi.fn().mockResolvedValue(repositories),
      gitService: {
        checkGitAvailability: vi.fn().mockResolvedValue(true),
        commit: vi.fn(),
        discardFile: vi.fn(),
        discardRepo: vi.fn(),
        getStatus,
        pull,
        push: vi.fn(),
        stageFile,
        unstageFile: vi.fn()
      },
      vaultPath: "C:/vault"
    });

    await controller.load();
    await controller.stageAll();
    await controller.pullAll();

    expect(stageFile).toHaveBeenNthCalledWith(1, "C:/vault/alpha", "tracked.ts");
    expect(stageFile).toHaveBeenNthCalledWith(2, "C:/vault/beta", "draft.md");
    expect(pull).toHaveBeenNthCalledWith(1, "C:/vault/alpha");
    expect(pull).toHaveBeenNthCalledWith(2, "C:/vault/beta");
  });

  it("uses an autogenerated commit message when the field is empty", async () => {
    const repositories: RepoInfo[] = [
      { branch: "", relativePath: "alpha", rootPath: "C:/vault/alpha" }
    ];
    const getStatus = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        stderr: "",
        stdout: "",
        data: createStatus("main", 1)
      })
      .mockResolvedValueOnce({
        ok: true,
        stderr: "",
        stdout: "",
        data: createStatus("main", 0)
      });
    const commit = vi.fn().mockResolvedValue({
      ok: true,
      stderr: "",
      stdout: ""
    });

    const controller = createMultiRepoController({
      discoverRepositories: vi.fn().mockResolvedValue(repositories),
      gitService: {
        checkGitAvailability: vi.fn().mockResolvedValue(true),
        commit,
        discardFile: vi.fn(),
        discardRepo: vi.fn(),
        getStatus,
        pull: vi.fn(),
        push: vi.fn(),
        stageFile: vi.fn(),
        unstageFile: vi.fn()
      },
      now: () => new Date("2026-03-16T18:05:00"),
      vaultPath: "C:/vault"
    });

    await controller.load();
    await controller.commit("C:/vault/alpha");

    expect(commit).toHaveBeenCalledWith("C:/vault/alpha", "update: 2026-03-16 18:05");
  });
});

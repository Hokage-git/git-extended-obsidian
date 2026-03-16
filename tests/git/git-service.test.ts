import { describe, expect, it, vi } from "vitest";
import path from "node:path";

import { createGitService } from "../../src/git/git-service";

describe("createGitService", () => {
  it("parses status output from the git command runner", async () => {
    const runner = vi.fn().mockResolvedValue({
      exitCode: 0,
      stderr: "",
      stdout: ["## main", "M  staged.ts", "?? new.md"].join("\n")
    });

    const service = createGitService(runner);
    const result = await service.getStatus("C:/vault/repo");

    expect(runner).toHaveBeenCalledWith("C:/vault/repo", [
      "status",
      "--porcelain=v1",
      "-b"
    ]);
    expect(result.ok).toBe(true);
    expect(result.data?.branch).toBe("main");
    expect(result.data?.staged[0]?.path).toBe("staged.ts");
    expect(result.data?.untracked[0]?.path).toBe("new.md");
  });

  it("returns stderr when a git command fails", async () => {
    const runner = vi.fn().mockResolvedValue({
      exitCode: 1,
      stderr: "fatal: remote rejected",
      stdout: ""
    });

    const service = createGitService(runner);
    const result = await service.push("C:/vault/repo");

    expect(result.ok).toBe(false);
    expect(result.stderr).toContain("remote rejected");
  });

  it("discards tracked files with restore staged and worktree", async () => {
    const runner = vi.fn().mockResolvedValue({
      exitCode: 0,
      stderr: "",
      stdout: ""
    });

    const service = createGitService(runner);
    const result = await service.discardFile("C:/vault/repo", "tracked.ts", true);

    expect(runner).toHaveBeenCalledWith("C:/vault/repo", [
      "restore",
      "--staged",
      "--worktree",
      "--",
      "tracked.ts"
    ]);
    expect(result.ok).toBe(true);
  });

  it("discards untracked files by deleting them from disk", async () => {
    const runner = vi.fn();
    const deletePath = vi.fn().mockResolvedValue(undefined);

    const service = createGitService(runner, { deletePath });
    const result = await service.discardFile("C:/vault/repo", "new.md", false);

    expect(deletePath).toHaveBeenCalledWith(path.join("C:/vault/repo", "new.md"));
    expect(runner).not.toHaveBeenCalled();
    expect(result.ok).toBe(true);
  });

  it("discards a repository with reset hard and clean fd", async () => {
    const runner = vi
      .fn()
      .mockResolvedValueOnce({
        exitCode: 0,
        stderr: "",
        stdout: "HEAD is now at abc123"
      })
      .mockResolvedValueOnce({
        exitCode: 0,
        stderr: "",
        stdout: "Removing note.md"
      });

    const service = createGitService(runner);
    const result = await service.discardRepo("C:/vault/repo");

    expect(runner).toHaveBeenNthCalledWith(1, "C:/vault/repo", [
      "reset",
      "--hard",
      "HEAD"
    ]);
    expect(runner).toHaveBeenNthCalledWith(2, "C:/vault/repo", ["clean", "-fd"]);
    expect(result.ok).toBe(true);
    expect(result.stdout).toContain("HEAD is now at");
    expect(result.stdout).toContain("Removing note.md");
  });
});

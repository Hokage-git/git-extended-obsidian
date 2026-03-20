import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { discoverRepositories } from "../../src/discovery/repo-discovery-service";

const tempDirs: string[] = [];

async function makeTempVault(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "multi-repo-vault-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))
  );
});

describe("discoverRepositories", () => {
  it("finds nested git repositories and returns relative paths", async () => {
    const vaultPath = await makeTempVault();
    const parentRepo = path.join(vaultPath, "projects", "alpha");
    const nestedRepo = path.join(parentRepo, "packages", "beta");
    const nonRepoDir = path.join(vaultPath, "notes");

    await mkdir(path.join(parentRepo, ".git"), { recursive: true });
    await mkdir(path.join(nestedRepo, ".git"), { recursive: true });
    await mkdir(nonRepoDir, { recursive: true });

    const repositories = await discoverRepositories(vaultPath);

    expect(repositories).toEqual([
      {
        branch: "",
        relativePath: "projects/alpha",
        rootPath: parentRepo
      },
      {
        branch: "",
        relativePath: "projects/alpha/packages/beta",
        rootPath: nestedRepo
      }
    ]);
  });

  it("treats a .git file as a repository marker", async () => {
    const vaultPath = await makeTempVault();
    const repoRoot = path.join(vaultPath, "linked-repo");

    await mkdir(repoRoot, { recursive: true });
    await writeFile(path.join(repoRoot, ".git"), "gitdir: C:/external/repo/.git\n");

    const repositories = await discoverRepositories(vaultPath);

    expect(repositories).toEqual([
      {
        branch: "",
        relativePath: "linked-repo",
        rootPath: repoRoot
      }
    ]);
  });

  it("skips unreadable directories and keeps scanning the rest of the vault", async () => {
    vi.resetModules();
    const root = path.normalize("C:/vault");
    const blocked = path.join(root, "blocked");
    const projects = path.join(root, "projects");
    const alpha = path.join(projects, "alpha");

    const readdir = vi.fn(async (currentPath: string) => {
      if (path.normalize(currentPath) === root) {
        return [
          { isDirectory: () => true, name: "blocked" },
          { isDirectory: () => true, name: "projects" }
        ];
      }

      if (path.normalize(currentPath) === blocked) {
        throw Object.assign(new Error("EACCES"), { code: "EACCES" });
      }

      if (path.normalize(currentPath) === projects) {
        return [{ isDirectory: () => true, name: "alpha" }];
      }

      if (path.normalize(currentPath) === alpha) {
        return [{ isDirectory: () => false, name: ".git" }];
      }

      return [];
    });

    vi.doMock("node:fs/promises", () => ({ readdir }));

    const { discoverRepositories: discoverWithMock } = await import(
      "../../src/discovery/repo-discovery-service"
    );

    await expect(discoverWithMock("C:/vault")).resolves.toEqual([
      {
        branch: "",
        relativePath: "projects/alpha",
        rootPath: alpha
      }
    ]);

    vi.doUnmock("node:fs/promises");
    vi.resetModules();
  });
});

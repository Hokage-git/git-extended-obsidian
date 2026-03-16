import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

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
});

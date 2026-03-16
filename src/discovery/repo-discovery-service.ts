import { readdir } from "node:fs/promises";
import path from "node:path";

import type { RepoInfo } from "../types";

function toRelativeRepoInfo(vaultPath: string, repoRoot: string): RepoInfo {
  return {
    rootPath: repoRoot,
    relativePath: path.relative(vaultPath, repoRoot).split(path.sep).join("/"),
    branch: ""
  };
}

async function scanDirectory(
  currentPath: string,
  results: string[]
): Promise<void> {
  const entries = await readdir(currentPath, { withFileTypes: true });
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

    await scanDirectory(path.join(currentPath, entry.name), results);
  }
}

export async function discoverRepositories(
  vaultPath: string
): Promise<RepoInfo[]> {
  const repositories: string[] = [];

  await scanDirectory(vaultPath, repositories);

  return repositories
    .sort((left, right) => left.localeCompare(right))
    .map((repoRoot) => toRelativeRepoInfo(vaultPath, repoRoot));
}

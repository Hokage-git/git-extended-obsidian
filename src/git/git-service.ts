import { execFile } from "node:child_process";
import { rm } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { parseStatusPorcelain } from "./status-parser";
import type {
  GitCommandResult,
  PulledFileChange,
  PullResultData,
  RepoStatusSnapshot
} from "../types";

const execFileAsync = promisify(execFile);

export interface GitRunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export type GitCommandRunner = (
  repoRoot: string,
  args: string[]
) => Promise<GitRunResult>;

type DeletePath = (targetPath: string) => Promise<void>;

type GitServiceDependencies = {
  deletePath?: DeletePath;
};

async function defaultRunner(
  repoRoot: string,
  args: string[]
): Promise<GitRunResult> {
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
    const gitError = error as {
      code?: number;
      stderr?: string;
      stdout?: string;
    };

    return {
      exitCode: gitError.code ?? 1,
      stderr: gitError.stderr ?? "",
      stdout: gitError.stdout ?? ""
    };
  }
}

function toCommandResult<T>(
  runResult: GitRunResult,
  data?: T
): GitCommandResult<T> {
  return {
    ok: runResult.exitCode === 0,
    stdout: runResult.stdout,
    stderr: runResult.stderr,
    data
  };
}

function withDefaultGitConfig(args: string[]): string[] {
  return ["-c", "core.quotepath=false", ...args];
}

function parsePullNameStatus(output: string): PulledFileChange[] {
  const changes: PulledFileChange[] = [];

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

export function createGitService(
  runner: GitCommandRunner = defaultRunner,
  dependencies: GitServiceDependencies = {}
) {
  const deletePath = dependencies.deletePath ?? ((targetPath: string) =>
    rm(targetPath, { force: true, recursive: true }));

  return {
    async checkGitAvailability(): Promise<boolean> {
      const result = await runner(process.cwd(), withDefaultGitConfig(["--version"]));
      return result.exitCode === 0;
    },

    async getStatus(repoRoot: string): Promise<GitCommandResult<RepoStatusSnapshot>> {
      const result = await runner(
        repoRoot,
        withDefaultGitConfig(["status", "--porcelain=v1", "-b"])
      );
      return toCommandResult(
        result,
        result.exitCode === 0 ? parseStatusPorcelain(result.stdout) : undefined
      );
    },

    async stageFile(repoRoot: string, filePath: string): Promise<GitCommandResult> {
      return toCommandResult(
        await runner(repoRoot, withDefaultGitConfig(["add", "--", filePath]))
      );
    },

    async unstageFile(repoRoot: string, filePath: string): Promise<GitCommandResult> {
      return toCommandResult(
        await runner(
          repoRoot,
          withDefaultGitConfig(["restore", "--staged", "--", filePath])
        )
      );
    },

    async commit(repoRoot: string, message: string): Promise<GitCommandResult> {
      return toCommandResult(
        await runner(repoRoot, withDefaultGitConfig(["commit", "-m", message]))
      );
    },

    async pull(repoRoot: string): Promise<GitCommandResult<PullResultData>> {
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

    async push(repoRoot: string): Promise<GitCommandResult> {
      return toCommandResult(await runner(repoRoot, withDefaultGitConfig(["push"])));
    },

    async discardFile(
      repoRoot: string,
      filePath: string,
      tracked: boolean
    ): Promise<GitCommandResult> {
      if (!tracked) {
        try {
          await deletePath(path.join(repoRoot, filePath));
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

    async discardRepo(repoRoot: string): Promise<GitCommandResult> {
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

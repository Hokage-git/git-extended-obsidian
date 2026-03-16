import type { RepoOperationKind, RepoOperationResult, RepoOperationStatus } from "../types";

function toPastTense(operation: RepoOperationKind): string {
  return operation === "pull" ? "Pulled" : "Pushed";
}

function toRepoOutcomeLabel(status: RepoOperationStatus): string {
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

export function formatRepoOperationNotice(
  operation: RepoOperationKind,
  repoPath: string,
  success: boolean,
  error?: string,
  status: RepoOperationStatus = success ? "completed" : "failed"
): string {
  if (operation === "pull" && status === "upToDate") {
    return `${repoPath} is already up to date`;
  }

  if (success) {
    return `${toPastTense(operation)} ${repoPath}`;
  }

  return `${operation === "pull" ? "Pull" : "Push"} failed for ${repoPath}: ${error ?? "Git command failed"}`;
}

export function formatBulkOperationNotice(
  operation: RepoOperationKind,
  successCount: number,
  failureCount: number
): string {
  const base = `${toPastTense(operation)} ${successCount} repositories`;
  return failureCount > 0 ? `${base}, ${failureCount} failed` : base;
}

export function formatDetailedBulkOperationNotice(
  operation: RepoOperationKind,
  details: RepoOperationResult[]
): string {
  return details
    .map((detail) => {
      const repoPath = detail.repoPath || detail.repoRoot;
      if (!detail.ok) {
        return `${repoPath}: failed: ${detail.error ?? "Git command failed"}`;
      }

      if (operation === "pull") {
        return `${repoPath}: ${toRepoOutcomeLabel(detail.status)}`;
      }

      return `${repoPath}: ${toPastTense(operation).toLowerCase()}`;
    })
    .join("\n");
}

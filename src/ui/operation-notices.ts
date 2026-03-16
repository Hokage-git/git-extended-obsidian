export type RepoOperationKind = "pull" | "push";

function toPastTense(operation: RepoOperationKind): string {
  return operation === "pull" ? "Pulled" : "Pushed";
}

export function formatRepoOperationNotice(
  operation: RepoOperationKind,
  repoPath: string,
  success: boolean,
  error?: string
): string {
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

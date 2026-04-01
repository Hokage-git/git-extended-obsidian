export type RepoActionId =
  | "refresh"
  | "stageAll"
  | "unstageAll"
  | "pull"
  | "push"
  | "discard"
  | "dropLocalCommit";

export const GLOBAL_REPO_ACTIONS: RepoActionId[] = [
  "refresh",
  "stageAll",
  "unstageAll",
  "pull",
  "push",
  "discard"
];

export const REPO_ACTIONS: RepoActionId[] = [
  "refresh",
  "stageAll",
  "unstageAll",
  "pull",
  "push",
  "dropLocalCommit",
  "discard"
];

const ACTION_ICONS: Record<RepoActionId, string> = {
  refresh: "refresh-cw",
  stageAll: "plus",
  unstageAll: "minus",
  pull: "download",
  push: "upload",
  discard: "trash-2",
  dropLocalCommit: "undo-2"
};

export function getActionIcons(actions: RepoActionId[]): string[] {
  return actions.map((action) => ACTION_ICONS[action]);
}

export function getActionIcon(action: RepoActionId): string {
  return ACTION_ICONS[action];
}

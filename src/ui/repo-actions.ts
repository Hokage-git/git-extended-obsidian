export type RepoActionId = "refresh" | "stageAll" | "pull" | "push" | "discard";

export const GLOBAL_REPO_ACTIONS: RepoActionId[] = [
  "refresh",
  "stageAll",
  "pull",
  "push",
  "discard"
];

export const REPO_ACTIONS: RepoActionId[] = [
  "refresh",
  "stageAll",
  "pull",
  "push",
  "discard"
];

const ACTION_ICONS: Record<RepoActionId, string> = {
  refresh: "refresh-cw",
  stageAll: "plus",
  pull: "download",
  push: "upload",
  discard: "trash-2"
};

export function getActionIcons(actions: RepoActionId[]): string[] {
  return actions.map((action) => ACTION_ICONS[action]);
}

export function getActionIcon(action: RepoActionId): string {
  return ACTION_ICONS[action];
}

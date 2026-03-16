export type ConfirmActionKind = "discard" | "pull" | "stage";

export function getConfirmActionLabel(action: ConfirmActionKind): string {
  switch (action) {
    case "pull":
      return "Pull";
    case "stage":
      return "Stage";
    default:
      return "Discard";
  }
}

export type DismissibleErrorState = {
  dismissed: boolean;
  message: string;
};

export function syncDismissibleErrorState(
  current: DismissibleErrorState | undefined,
  message: string | undefined
): DismissibleErrorState | undefined {
  if (!message) {
    return undefined;
  }

  if (!current || current.message !== message) {
    return {
      message,
      dismissed: false
    };
  }

  return current;
}

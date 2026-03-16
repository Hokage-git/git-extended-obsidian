import { describe, expect, it } from "vitest";

import { syncDismissibleErrorState } from "../../src/ui/error-visibility";

describe("syncDismissibleErrorState", () => {
  it("creates visible state for a new error message", () => {
    expect(syncDismissibleErrorState(undefined, "Boom")).toEqual({
      message: "Boom",
      dismissed: false
    });
  });

  it("preserves dismissed state for the same message", () => {
    expect(
      syncDismissibleErrorState(
        {
          message: "Boom",
          dismissed: true
        },
        "Boom"
      )
    ).toEqual({
      message: "Boom",
      dismissed: true
    });
  });

  it("resets dismissal when the error message changes", () => {
    expect(
      syncDismissibleErrorState(
        {
          message: "Boom",
          dismissed: true
        },
        "Different"
      )
    ).toEqual({
      message: "Different",
      dismissed: false
    });
  });

  it("clears state when there is no error", () => {
    expect(
      syncDismissibleErrorState(
        {
          message: "Boom",
          dismissed: false
        },
        undefined
      )
    ).toBeUndefined();
  });
});

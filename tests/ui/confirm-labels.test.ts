import { describe, expect, it } from "vitest";

import { getConfirmActionLabel } from "../../src/ui/confirm-labels";

describe("confirm labels", () => {
  it("returns action-specific labels instead of generic confirm text", () => {
    expect(getConfirmActionLabel("pull")).toBe("Pull");
    expect(getConfirmActionLabel("stage")).toBe("Stage");
    expect(getConfirmActionLabel("discard")).toBe("Discard");
  });
});

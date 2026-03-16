import { describe, expect, it } from "vitest";

import {
  formatBulkOperationNotice,
  formatRepoOperationNotice
} from "../../src/ui/operation-notices";

describe("operation notices", () => {
  it("formats successful repo operation notices", () => {
    expect(formatRepoOperationNotice("pull", "projects/alpha", true)).toBe(
      "Pulled projects/alpha"
    );
    expect(formatRepoOperationNotice("push", ".", true)).toBe("Pushed .");
  });

  it("formats failed repo operation notices", () => {
    expect(
      formatRepoOperationNotice("pull", "projects/alpha", false, "Merge conflict")
    ).toBe("Pull failed for projects/alpha: Merge conflict");
  });

  it("formats bulk operation notices", () => {
    expect(formatBulkOperationNotice("pull", 3, 0)).toBe("Pulled 3 repositories");
    expect(formatBulkOperationNotice("pull", 2, 1)).toBe(
      "Pulled 2 repositories, 1 failed"
    );
    expect(formatBulkOperationNotice("push", 1, 2)).toBe(
      "Pushed 1 repositories, 2 failed"
    );
  });
});

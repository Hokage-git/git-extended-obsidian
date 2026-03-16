import { describe, expect, it } from "vitest";

import {
  formatBulkOperationNotice,
  formatDetailedBulkOperationNotice,
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

  it("formats up-to-date repo operation notices", () => {
    expect(
      formatRepoOperationNotice("pull", "projects/alpha", true, undefined, "upToDate")
    ).toBe("projects/alpha is already up to date");
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

  it("formats detailed bulk pull notices with one line per repository", () => {
    expect(
      formatDetailedBulkOperationNotice("pull", [
        {
          operation: "pull",
          repoRoot: "C:/vault/alpha",
          repoPath: "alpha",
          ok: true,
          status: "pulled"
        },
        {
          operation: "pull",
          repoRoot: "C:/vault/beta",
          repoPath: "beta",
          ok: true,
          status: "upToDate"
        },
        {
          operation: "pull",
          repoRoot: "C:/vault/gamma",
          repoPath: "gamma",
          ok: false,
          status: "failed",
          error: "no upstream configured"
        }
      ])
    ).toBe(
      ["alpha: pulled", "beta: already up to date", "gamma: failed: no upstream configured"].join("\n")
    );
  });
});

import { describe, expect, it } from "vitest";

import { parseStatusPorcelain } from "../../src/git/status-parser";

describe("status parser", () => {
  it("groups staged unstaged and untracked files", () => {
    const output = [
      "## main",
      "M  staged-only.ts",
      " M unstaged-only.ts",
      "MM both-sides.ts",
      "R  old-name.ts -> new-name.ts",
      "?? notes.md",
      "UU conflicted.ts"
    ].join("\n");

    const status = parseStatusPorcelain(output);

    expect(status.branch).toBe("main");
    expect(status.staged).toHaveLength(3);
    expect(status.unstaged).toHaveLength(3);
    expect(status.untracked).toEqual([
      {
        kind: "untracked",
        path: "notes.md",
        x: "?",
        y: "?"
      }
    ]);
    expect(status.staged).toEqual([
      {
        kind: "modified",
        path: "staged-only.ts",
        x: "M",
        y: " "
      },
      {
        kind: "modified",
        path: "both-sides.ts",
        x: "M",
        y: "M"
      },
      {
        kind: "renamed",
        path: "new-name.ts",
        x: "R",
        y: " "
      }
    ]);
    expect(status.unstaged).toEqual([
      {
        kind: "modified",
        path: "unstaged-only.ts",
        x: " ",
        y: "M"
      },
      {
        kind: "modified",
        path: "both-sides.ts",
        x: "M",
        y: "M"
      },
      {
        kind: "conflict",
        path: "conflicted.ts",
        x: "U",
        y: "U"
      }
    ]);
  });
});

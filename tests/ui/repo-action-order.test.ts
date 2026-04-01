import { describe, expect, it } from "vitest";

import {
  GLOBAL_REPO_ACTIONS,
  REPO_ACTIONS,
  getActionIcons
} from "../../src/ui/repo-actions";

describe("repo action order", () => {
  it("keeps the configured icon order for header and repository cards", () => {
    expect(getActionIcons(GLOBAL_REPO_ACTIONS)).toEqual([
      "refresh-cw",
      "plus",
      "minus",
      "download",
      "upload",
      "trash-2"
    ]);
    expect(getActionIcons(REPO_ACTIONS)).toEqual([
      "refresh-cw",
      "plus",
      "minus",
      "download",
      "upload",
      "undo-2",
      "trash-2"
    ]);
  });
});

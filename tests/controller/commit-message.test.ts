import { describe, expect, it } from "vitest";

import { createAutoCommitMessage } from "../../src/controller/commit-message";

describe("createAutoCommitMessage", () => {
  it("formats the default commit message with local date and time", () => {
    expect(createAutoCommitMessage(new Date("2026-03-16T18:05:00"))).toBe(
      "update: 2026-03-16 18:05"
    );
  });
});

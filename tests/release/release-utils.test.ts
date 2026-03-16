import { describe, expect, test } from "vitest";

import {
  createReleaseArchiveName,
  getManifestVersion,
  getReleaseFileNames,
  validateReleaseTagRef
} from "../../src/release/release-utils.mjs";

describe("getManifestVersion", () => {
  test("returns version from manifest content", () => {
    expect(
      getManifestVersion(
        JSON.stringify({
          id: "git-extended-obsidian",
          version: "1.0.0"
        })
      )
    ).toBe("1.0.0");
  });

  test("throws when version is missing", () => {
    expect(() => getManifestVersion(JSON.stringify({ id: "git-extended-obsidian" }))).toThrow(
      "manifest.json version is missing"
    );
  });
});

describe("validateReleaseTagRef", () => {
  test("accepts a matching release tag ref", () => {
    expect(() => validateReleaseTagRef("refs/tags/v1.0.0", "1.0.0")).not.toThrow();
  });

  test("rejects a mismatched release tag ref", () => {
    expect(() => validateReleaseTagRef("refs/tags/v1.0.1", "1.0.0")).toThrow(
      "Release tag v1.0.1 does not match manifest version 1.0.0"
    );
  });

  test("rejects a non-tag ref", () => {
    expect(() => validateReleaseTagRef("refs/heads/main", "1.0.0")).toThrow(
      "GITHUB_REF must point to a tag, received refs/heads/main"
    );
  });
});

describe("release packaging helpers", () => {
  test("returns the expected release archive name", () => {
    expect(createReleaseArchiveName("1.0.0")).toBe("git-extended-obsidian-1.0.0.zip");
  });

  test("returns the expected release file names", () => {
    expect(getReleaseFileNames()).toEqual(["main.js", "manifest.json", "styles.css"]);
  });
});

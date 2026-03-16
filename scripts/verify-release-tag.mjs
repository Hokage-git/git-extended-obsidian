import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

import { getManifestVersion, validateReleaseTagRef } from "../src/release/release-utils.mjs";

const repoRoot = process.cwd();
const manifestPath = path.join(repoRoot, "manifest.json");
const manifestContent = readFileSync(manifestPath, "utf8");
const version = getManifestVersion(manifestContent);
const ref = process.env.GITHUB_REF;

if (!ref) {
  throw new Error("GITHUB_REF is required");
}

validateReleaseTagRef(ref, version);

process.stdout.write(`Release tag ${ref} matches manifest version ${version}.\n`);

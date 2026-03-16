import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";

import {
  createReleaseArchiveName,
  getManifestVersion,
  getReleaseFileNames
} from "../src/release/release-utils.mjs";

const repoRoot = process.cwd();
const manifestPath = path.join(repoRoot, "manifest.json");
const manifestContent = readFileSync(manifestPath, "utf8");
const version = getManifestVersion(manifestContent);
const releaseDir = path.join(repoRoot, "release");
const archiveName = createReleaseArchiveName(version);
const archivePath = path.join(releaseDir, archiveName);
const releaseFiles = getReleaseFileNames();

for (const fileName of releaseFiles) {
  const filePath = path.join(repoRoot, fileName);

  if (!existsSync(filePath)) {
    throw new Error(`Required release file is missing: ${fileName}`);
  }
}

mkdirSync(releaseDir, { recursive: true });
rmSync(archivePath, { force: true });

const command = [
  "$ErrorActionPreference = 'Stop'",
  `$archivePath = '${archivePath.replace(/'/g, "''")}'`,
  "$paths = @(",
  ...releaseFiles.map((fileName) => `  '${path.join(repoRoot, fileName).replace(/'/g, "''")}'`),
  ")",
  "Compress-Archive -LiteralPath $paths -DestinationPath $archivePath -CompressionLevel Optimal"
].join("; ");

const result = spawnSync("powershell", ["-NoProfile", "-Command", command], {
  cwd: repoRoot,
  stdio: "inherit"
});

if (result.status !== 0) {
  throw new Error(`Compress-Archive failed with exit code ${result.status ?? "unknown"}`);
}

process.stdout.write(`Created release archive: ${archivePath}\n`);

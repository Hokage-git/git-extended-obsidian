const RELEASE_FILES = ["main.js", "manifest.json", "styles.css"];

export function getManifestVersion(manifestContent) {
  const manifest = JSON.parse(manifestContent);

  if (typeof manifest.version !== "string" || manifest.version.trim().length === 0) {
    throw new Error("manifest.json version is missing");
  }

  return manifest.version;
}

export function validateReleaseTagRef(ref, version) {
  if (!ref.startsWith("refs/tags/")) {
    throw new Error(`GITHUB_REF must point to a tag, received ${ref}`);
  }

  const tag = ref.slice("refs/tags/".length);
  const expectedTag = `v${version}`;

  if (tag !== expectedTag) {
    throw new Error(`Release tag ${tag} does not match manifest version ${version}`);
  }
}

export function createReleaseArchiveName(version) {
  return `git-extended-${version}.zip`;
}

export function getReleaseFileNames() {
  return [...RELEASE_FILES];
}

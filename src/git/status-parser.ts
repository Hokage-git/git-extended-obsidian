import type { RepoFileChange, RepoStatusSnapshot } from "../types";

const CONFLICT_CODES = new Set(["DD", "AU", "UD", "UA", "DU", "AA", "UU"]);

function parseBranch(line: string): string {
  return line.slice(3).trim().split("...")[0] ?? "";
}

function normalizePath(rawPath: string): string {
  const renamedMarker = " -> ";
  if (rawPath.includes(renamedMarker)) {
    return decodePorcelainPath(rawPath.split(renamedMarker)[1] ?? rawPath);
  }

  return decodePorcelainPath(rawPath);
}

function decodePorcelainPath(rawPath: string): string {
  if (rawPath.length < 2 || rawPath[0] !== `"` || rawPath[rawPath.length - 1] !== `"`) {
    return rawPath;
  }

  const bytes: number[] = [];

  function appendText(value: string): void {
    bytes.push(...Buffer.from(value, "utf8"));
  }

  for (let index = 1; index < rawPath.length - 1; index += 1) {
    const current = rawPath[index];
    if (current !== "\\") {
      appendText(current);
      continue;
    }

    const next = rawPath[index + 1];
    if (next === undefined) {
      appendText("\\");
      continue;
    }

    if (next === "\\" || next === `"`) {
      appendText(next);
      index += 1;
      continue;
    }

    if (next === "t") {
      appendText("\t");
      index += 1;
      continue;
    }

    if (next === "n") {
      appendText("\n");
      index += 1;
      continue;
    }

    const octal = rawPath.slice(index + 1, index + 4);
    if (/^[0-7]{3}$/.test(octal)) {
      bytes.push(Number.parseInt(octal, 8));
      index += 3;
      continue;
    }

    appendText(next);
    index += 1;
  }

  return Buffer.from(bytes).toString("utf8");
}

function toKind(code: string): RepoFileChange["kind"] {
  switch (code) {
    case "R":
      return "renamed";
    case "D":
      return "deleted";
    case "?":
      return "untracked";
    case "U":
      return "conflict";
    default:
      return "modified";
  }
}

export function parseStatusPorcelain(output: string): RepoStatusSnapshot {
  const snapshot: RepoStatusSnapshot = {
    branch: "",
    staged: [],
    unstaged: [],
    untracked: []
  };

  for (const line of output.split(/\r?\n/)) {
    if (!line) {
      continue;
    }

    if (line.startsWith("## ")) {
      snapshot.branch = parseBranch(line);
      continue;
    }

    const x = line[0] ?? " ";
    const y = line[1] ?? " ";
    const path = normalizePath(line.slice(3));
    const combined = `${x}${y}`;

    if (combined === "??") {
      snapshot.untracked.push({ kind: "untracked", path, x, y });
      continue;
    }

    if (CONFLICT_CODES.has(combined)) {
      snapshot.unstaged.push({ kind: "conflict", path, x, y });
      continue;
    }

    if (x !== " ") {
      snapshot.staged.push({ kind: toKind(x), path, x, y });
    }

    if (y !== " ") {
      snapshot.unstaged.push({ kind: toKind(y), path, x, y });
    }
  }

  return snapshot;
}

import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

export interface SnapshotDiff {
  added: string[];
  changed: string[];
  removed: string[];
  unchanged: number;
  files: number;
  sourceDigest: string | null;
  targetDigest: string | null;
  status: "clean" | "changed";
}

export function listSnapshotPaths(root: string): string[] {
  if (!existsSync(root)) return [];

  const paths: string[] = [];
  const walk = (current: string, prefix: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        walk(join(current, entry.name), relative);
      } else if (entry.isFile()) {
        paths.push(relative);
      }
    }
  };

  walk(root, "");
  return paths.sort();
}

function digestFile(root: string, relativePath: string): string {
  return createHash("sha256")
    .update(readFileSync(join(root, relativePath)))
    .digest("hex");
}

export function digestSnapshot(root: string): string | null {
  if (!existsSync(root) || !statSync(root).isDirectory()) return null;

  const digest = createHash("sha256");
  for (const relativePath of listSnapshotPaths(root)) {
    digest.update(relativePath);
    digest.update("\0");
    digest.update(digestFile(root, relativePath));
    digest.update("\n");
  }
  return digest.digest("hex");
}

export function compareSnapshots(sourceRoot: string, targetRoot: string): SnapshotDiff {
  const sourcePaths = listSnapshotPaths(sourceRoot);
  const targetPaths = listSnapshotPaths(targetRoot);
  const sourceSet = new Set(sourcePaths);
  const targetSet = new Set(targetPaths);
  const added = sourcePaths.filter((path) => !targetSet.has(path));
  const removed = targetPaths.filter((path) => !sourceSet.has(path));
  const common = sourcePaths.filter((path) => targetSet.has(path));
  const changed = common.filter((path) => digestFile(sourceRoot, path) !== digestFile(targetRoot, path));

  return {
    added,
    changed,
    removed,
    unchanged: common.length - changed.length,
    files: sourcePaths.length,
    sourceDigest: digestSnapshot(sourceRoot),
    targetDigest: digestSnapshot(targetRoot),
    status: added.length || changed.length || removed.length ? "changed" : "clean",
  };
}

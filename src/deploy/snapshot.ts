import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export interface SnapshotDiff {
  added: string[];
  changed: string[];
  removed: string[];
  unchanged: number;
  files: number;
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
    status: added.length || changed.length || removed.length ? "changed" : "clean",
  };
}

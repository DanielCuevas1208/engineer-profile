import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { openDatabase } from "../db/client.js";
import type { DeployTarget, PortfolioConfig } from "../types.js";

export interface DeployResult {
  targetName: string;
  targetPath: string;
  files: number;
  removed: number;
  verified: boolean;
}

function isPathInside(parent: string, child: string): boolean {
  const rel = relative(parent, child);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

function listFilesRecursive(root: string): string[] {
  const files: string[] = [];
  const walk = (current: string, prefix: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        walk(join(current, entry.name), relative);
      } else {
        files.push(relative);
      }
    }
  };
  walk(root, "");
  return files;
}

export function deployLocal(
  config: PortfolioConfig,
  target: DeployTarget
): DeployResult {
  const indexPath = join(config.outputDir, "index.html");
  if (!existsSync(indexPath)) {
    throw new Error(`No published site found at "${config.outputDir}". Run publish first.`);
  }

  const outputRoot = resolve(config.outputDir);
  const targetRoot = resolve(target.target);
  if (isPathInside(outputRoot, targetRoot)) {
    throw new Error(
      `Deploy target "${target.name}" must be outside the output directory "${config.outputDir}".`
    );
  }

  mkdirSync(target.target, { recursive: true });
  const outputFiles = listFilesRecursive(outputRoot);
  const existingFiles = listFilesRecursive(targetRoot);

  let removed = 0;
  for (const relative of existingFiles) {
    if (outputFiles.includes(relative)) continue;
    rmSync(join(targetRoot, relative), { force: true });
    removed++;
  }

  cpSync(config.outputDir, target.target, { recursive: true, force: true });
  const files = listFilesRecursive(targetRoot).length;
  const verified =
    existsSync(join(targetRoot, "index.html")) &&
    existsSync(join(targetRoot, "site-manifest.json"));

  const db = openDatabase(config.dataDir, config.clock);
  try {
    const detail = `${target.name} -> ${target.target} (${files} files, ${removed} removed, ${verified ? "verified" : "unverified"})`;
    db.logIngest("deploy", detail);
  } finally {
    db.close();
  }

  return { targetName: target.name, targetPath: target.target, files, removed, verified };
}

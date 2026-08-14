import { existsSync, statSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import type { LocalDeployTarget, PortfolioConfig } from "../types.js";
import { compareSnapshots, type SnapshotDiff } from "./snapshot.js";

export interface DeployPreview extends SnapshotDiff {
  targetName: string;
  targetPath: string;
}

function isPathInside(parent: string, child: string): boolean {
  const rel = relative(parent, child);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

function validatePreview(config: PortfolioConfig, target: LocalDeployTarget): { outputRoot: string; targetRoot: string } {
  const outputRoot = resolve(config.outputDir);
  const targetRoot = resolve(target.target);
  if (!existsSync(join(config.outputDir, "index.html"))) {
    throw new Error(`No published site found at "${config.outputDir}". Run publish first.`);
  }
  if (isPathInside(outputRoot, targetRoot)) {
    throw new Error(
      `Deploy target "${target.name}" must be outside the output directory "${config.outputDir}".`
    );
  }
  if (existsSync(targetRoot) && !statSync(targetRoot).isDirectory()) {
    throw new Error(`Deploy target "${target.name}" is not a directory: "${target.target}".`);
  }
  return { outputRoot, targetRoot };
}

export function previewLocal(config: PortfolioConfig, target: LocalDeployTarget): DeployPreview {
  const { outputRoot, targetRoot } = validatePreview(config, target);
  return {
    targetName: target.name,
    targetPath: target.target,
    ...compareSnapshots(outputRoot, targetRoot),
  };
}

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import type { DeploymentConfig } from "../types.js";

export interface DeployResult {
  adapter: string;
  target: string | null;
  filesCopied: number;
}

export interface DeploymentAdapter {
  readonly name: string;
  deploy(sourceDir: string, config: DeploymentConfig): DeployResult;
}

function countFiles(dir: string): number {
  let count = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    count += entry.isDirectory() ? countFiles(full) : 1;
  }
  return count;
}

function pathsOverlap(a: string, b: string): boolean {
  const relativePath = relative(a, b);
  return relativePath === "" || (!isAbsolute(relativePath) && !relativePath.startsWith(".."));
}

const NONE_ADAPTER: DeploymentAdapter = {
  name: "none",
  deploy() {
    return { adapter: "none", target: null, filesCopied: 0 };
  },
};

const LOCAL_ADAPTER: DeploymentAdapter = {
  name: "local",
  deploy(sourceDir, config) {
    const targetDir = config.targetDir?.trim();
    if (!targetDir) {
      throw new Error('Local deployment requires a "deploy.targetDir" setting.');
    }
    if (!existsSync(sourceDir)) {
      throw new Error(`Nothing to deploy: output directory "${sourceDir}" does not exist.`);
    }

    const sourceAbs = resolve(sourceDir);
    const targetAbs = resolve(targetDir);
    if (pathsOverlap(sourceAbs, targetAbs)) {
      throw new Error(
        `Deployment target "${targetDir}" must not overlap the output directory "${sourceDir}".`
      );
    }

    mkdirSync(targetAbs, { recursive: true });
    rmSync(targetAbs, { recursive: true, force: true });
    mkdirSync(targetAbs, { recursive: true });
    cpSync(sourceAbs, targetAbs, { recursive: true });

    return { adapter: "local", target: targetAbs, filesCopied: countFiles(targetAbs) };
  },
};

const ADAPTERS: Record<string, DeploymentAdapter> = {
  none: NONE_ADAPTER,
  local: LOCAL_ADAPTER,
};

export function isKnownAdapter(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(ADAPTERS, name);
}

export function listAdapters(): string[] {
  return Object.keys(ADAPTERS);
}

export function resolveAdapter(name: string): DeploymentAdapter {
  const adapter = ADAPTERS[name];
  if (!adapter) {
    throw new Error(`Unknown deployment adapter "${name}". Available adapters: ${listAdapters().join(", ")}.`);
  }
  return adapter;
}

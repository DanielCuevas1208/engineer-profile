import { cpSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { openDatabase } from "../db/client.js";
import type { DeployTarget, PortfolioConfig } from "../types.js";

export interface DeployResult {
  targetName: string;
  targetPath: string;
  files: number;
}

function countFiles(targetPath: string): number {
  let total = 0;
  const walk = (current: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (entry.isDirectory()) walk(join(current, entry.name));
      else total++;
    }
  };
  walk(targetPath);
  return total;
}

export function deployLocal(config: PortfolioConfig, target: DeployTarget): DeployResult {
  const indexPath = join(config.outputDir, "index.html");
  if (!existsSync(indexPath)) {
    throw new Error(`No published site found at "${config.outputDir}". Run publish first.`);
  }

  mkdirSync(target.target, { recursive: true });
  cpSync(config.outputDir, target.target, { recursive: true });
  const files = countFiles(target.target);

  const db = openDatabase(config.dataDir, config.clock);
  try {
    db.logIngest("deploy", `${target.name} -> ${target.target}`);
  } finally {
    db.close();
  }

  return { targetName: target.name, targetPath: target.target, files };
}

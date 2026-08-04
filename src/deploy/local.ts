import { cpSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { openDatabase } from "../db/client.js";
import type { PortfolioConfig } from "../types.js";

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

export function deployLocal(
  config: PortfolioConfig,
  targetName: string,
  targetPath: string
): DeployResult {
  const indexPath = join(config.outputDir, "index.html");
  if (!existsSync(indexPath)) {
    throw new Error(`No published site found at "${config.outputDir}". Run publish first.`);
  }

  mkdirSync(targetPath, { recursive: true });
  cpSync(config.outputDir, targetPath, { recursive: true });
  const files = countFiles(targetPath);

  const db = openDatabase(config.dataDir, config.clock);
  try {
    db.logIngest("deploy", `${targetName} -> ${targetPath}`);
  } finally {
    db.close();
  }

  return { targetName, targetPath, files };
}

export function deployAll(config: PortfolioConfig): DeployResult[] {
  return config.deploy.targets
    .filter((target) => target.type === "local")
    .map((target) => deployLocal(config, target.name, target.target));
}

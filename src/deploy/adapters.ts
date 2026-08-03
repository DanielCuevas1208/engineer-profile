import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { openDatabase } from "../db/client.js";
import type { DeploymentConfig, PortfolioConfig } from "../types.js";

export interface DeploymentResult {
  platform: string;
  prepared: boolean;
  files: string[];
}

export function prepareDeployment(config: PortfolioConfig): DeploymentResult {
  switch (config.deployment.platform) {
    case "github-pages":
      return prepareGitHubPages(config, config.deployment);
    default:
      return { platform: "none", prepared: false, files: [] };
  }
}

function prepareGitHubPages(
  config: PortfolioConfig,
  deployment: DeploymentConfig
): DeploymentResult {
  mkdirSync(config.outputDir, { recursive: true });

  const files: string[] = [];
  writeFileSync(join(config.outputDir, ".nojekyll"), "", "utf-8");
  files.push(".nojekyll");

  if (deployment.cname) {
    writeFileSync(join(config.outputDir, "CNAME"), `${deployment.cname}\n`, "utf-8");
    files.push("CNAME");
  }

  const db = openDatabase(config.dataDir, config.clock);
  try {
    db.logIngest("deploy", `github-pages: ${files.join(", ")} -> ${config.outputDir}`);
  } finally {
    db.close();
  }

  return { platform: "github-pages", prepared: true, files };
}

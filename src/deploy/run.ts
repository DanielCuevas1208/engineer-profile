import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { openDatabase } from "../db/client.js";
import type { DeploymentConfig, PortfolioConfig } from "../types.js";
import { buildDeployPlan, getAdapter } from "./adapters.js";

export { deployAdapterIds } from "./adapters.js";

export interface DeployOptions extends DeploymentConfig {
  adapter?: string;
}

export interface DeployResult {
  adapterId: string;
  label: string;
  written: string[];
  instructions: string[];
}

export function prepareDeployment(
  config: PortfolioConfig,
  options: DeployOptions = {}
): DeployResult {
  const adapterId = options.adapter ?? config.deploy.adapter;
  if (!adapterId) {
    throw new Error(
      "No deployment adapter was configured. Pass --adapter or set deploy.adapter in the configuration file."
    );
  }
  getAdapter(adapterId);

  const indexPath = join(config.outputDir, "index.html");
  if (!existsSync(indexPath)) {
    throw new Error(
      `No published site was found at "${config.outputDir}". Run publish or refresh first.`
    );
  }

  const deployConfig: DeploymentConfig = {
    adapter: adapterId,
    siteUrl: options.siteUrl ?? config.deploy.siteUrl,
  };
  const plan = buildDeployPlan(adapterId, deployConfig);

  mkdirSync(config.outputDir, { recursive: true });
  const written = plan.files.map((file) => {
    const target = join(config.outputDir, file.path);
    writeFileSync(target, file.contents, "utf-8");
    return target;
  });

  const db = openDatabase(config.dataDir, config.clock);
  try {
    db.logIngest("deploy", `${adapterId} -> ${config.outputDir}`);
  } finally {
    db.close();
  }

  return {
    adapterId: plan.adapterId,
    label: plan.label,
    written,
    instructions: plan.instructions,
  };
}

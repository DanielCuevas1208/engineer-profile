import { openDatabase } from "../db/client.js";
import type { PortfolioConfig } from "../types.js";
import { resolveAdapter, type DeployResult } from "./adapters.js";

export interface DeployOptions {
  adapter?: string;
  targetDir?: string;
}

export function deployPortfolio(config: PortfolioConfig, options: DeployOptions = {}): DeployResult {
  const adapterName = options.adapter ?? config.deploy.adapter;
  const deployConfig = {
    adapter: adapterName as PortfolioConfig["deploy"]["adapter"],
    targetDir: options.targetDir ?? config.deploy.targetDir,
  };
  const adapter = resolveAdapter(adapterName);
  const result = adapter.deploy(config.outputDir, deployConfig);

  const db = openDatabase(config.dataDir, config.clock);
  try {
    const detail = result.target
      ? `${result.adapter} adapter: ${result.filesCopied} files -> ${result.target}`
      : `${result.adapter} adapter: no-op`;
    db.logIngest("deploy", detail);
  } finally {
    db.close();
  }

  return result;
}

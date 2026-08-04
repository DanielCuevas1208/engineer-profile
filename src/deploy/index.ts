import type { DeployTarget, PortfolioConfig } from "../types.js";
import { deployLocal, type DeployResult } from "./local.js";

export { deployLocal, type DeployResult } from "./local.js";

type DeployAdapter = (config: PortfolioConfig, target: DeployTarget) => DeployResult;

const ADAPTERS: Record<string, DeployAdapter> = {
  local: deployLocal,
};

export function deployTo(config: PortfolioConfig, target: DeployTarget): DeployResult {
  const adapter = ADAPTERS[target.type];
  if (!adapter) {
    throw new Error(`No deploy adapter is registered for type "${target.type}".`);
  }
  return adapter(config, target);
}

export function runDeploys(config: PortfolioConfig): DeployResult[] {
  return config.deploy.targets.map((target) => deployTo(config, target));
}

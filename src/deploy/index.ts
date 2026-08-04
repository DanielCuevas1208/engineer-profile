import type { DeployTarget, PortfolioConfig } from "../types.js";
import { deployLocal } from "./local.js";
import type { DeployResult } from "./local.js";

export type { DeployResult } from "./local.js";

export function deployToTarget(
  config: PortfolioConfig,
  target: DeployTarget
): DeployResult {
  if (target.type === "local") {
    return deployLocal(config, target);
  }
  throw new Error(`Unknown deploy adapter "${target.type}".`);
}

export function deployAll(config: PortfolioConfig): DeployResult[] {
  return config.deploy.targets.map((target) => deployToTarget(config, target));
}

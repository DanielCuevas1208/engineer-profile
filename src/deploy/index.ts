import type { DeployTarget, PortfolioConfig } from "../types.js";
import { deployLocal, type DeployResult } from "./local.js";

export type { DeployResult } from "./local.js";

export function deployToTarget(
  config: PortfolioConfig,
  target: DeployTarget
): DeployResult {
  switch (target.type) {
    case "local":
      return deployLocal(config, target);
    default: {
      const exhaustive: never = target.type;
      throw new Error(`Unknown deploy adapter "${exhaustive}".`);
    }
  }
}

export function deployAll(config: PortfolioConfig): DeployResult[] {
  return config.deploy.targets.map((target) => deployToTarget(config, target));
}

import type { DeployTarget, PortfolioConfig } from "../types.js";
import { deployLocal } from "./local.js";
import type { DeployResult } from "./local.js";
import { previewLocal } from "./preview.js";
import type { DeployPreview } from "./preview.js";

export type { DeployResult } from "./local.js";
export type { DeployPreview } from "./preview.js";

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

export function previewToTarget(
  config: PortfolioConfig,
  target: DeployTarget
): DeployPreview {
  if (target.type === "local") {
    return previewLocal(config, target);
  }
  throw new Error(`Unknown deploy adapter "${target.type}".`);
}

export function previewAll(config: PortfolioConfig): DeployPreview[] {
  return config.deploy.targets.map((target) => previewToTarget(config, target));
}

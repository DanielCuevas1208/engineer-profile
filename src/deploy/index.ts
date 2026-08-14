import type { DeployTarget, DeployTargetType, PortfolioConfig } from "../types.js";
import { deployLocal } from "./local.js";
import type { DeployResult } from "./local.js";
import { previewLocal } from "./preview.js";
import type { DeployPreview } from "./preview.js";
import { deployS3, previewS3 } from "./s3.js";
import { deployNetlify, previewNetlify } from "./netlify.js";
import { deployVercel, previewVercel } from "./vercel.js";
import { deployRsync, previewRsync } from "./rsync.js";

export type { DeployResult } from "./local.js";
export type { DeployPreview } from "./preview.js";
export { createDeployReport } from "./report.js";
export type { DeployReport, DeployReportMode, DeployReportTarget } from "./report.js";
export { verifyPublishedPage } from "./pages.js";
export type { PublishedPageVerification, PageFetcher } from "./pages.js";
export { deployLocal } from "./local.js";
export { previewLocal } from "./preview.js";
export { deployS3, previewS3, createS3SyncPlan, validateS3BucketName, inferContentType, inferCacheControl, buildS3Uri } from "./s3.js";
export type { S3SyncPlan, S3UploadItem } from "./s3.js";
export { deployNetlify, previewNetlify, generateNetlifyHeaders, generateNetlifyRedirects, buildNetlifyUri } from "./netlify.js";
export { deployVercel, previewVercel, generateVercelConfig, buildVercelUri } from "./vercel.js";
export type { VercelConfig, VercelHeaderRule } from "./vercel.js";
export { deployRsync, previewRsync, createRsyncPlan, buildRsyncUri, buildRemoteRsyncDestination } from "./rsync.js";
export type { RsyncCommandPlan } from "./rsync.js";

const SUPPORTED_ADAPTERS: DeployTargetType[] = ["local", "s3", "netlify", "vercel", "rsync"];

export function listSupportedAdapters(): DeployTargetType[] {
  return [...SUPPORTED_ADAPTERS];
}

export function isSupportedAdapter(type: string): type is DeployTargetType {
  return SUPPORTED_ADAPTERS.includes(type as DeployTargetType);
}

export function deployToTarget(
  config: PortfolioConfig,
  target: DeployTarget
): DeployResult {
  switch (target.type) {
    case "local":
      return deployLocal(config, target);
    case "s3":
      return deployS3(config, target);
    case "netlify":
      return deployNetlify(config, target);
    case "vercel":
      return deployVercel(config, target);
    case "rsync":
      return deployRsync(config, target);
    default:
      throw new Error(`Unknown deploy adapter "${(target as { type?: string }).type}".`);
  }
}

export function deployAll(config: PortfolioConfig): DeployResult[] {
  return config.deploy.targets.map((target) => deployToTarget(config, target));
}

export function previewToTarget(
  config: PortfolioConfig,
  target: DeployTarget
): DeployPreview {
  switch (target.type) {
    case "local":
      return previewLocal(config, target);
    case "s3":
      return previewS3(config, target);
    case "netlify":
      return previewNetlify(config, target);
    case "vercel":
      return previewVercel(config, target);
    case "rsync":
      return previewRsync(config, target);
    default:
      throw new Error(`Unknown deploy adapter "${(target as { type?: string }).type}".`);
  }
}

export function previewAll(config: PortfolioConfig): DeployPreview[] {
  return config.deploy.targets.map((target) => previewToTarget(config, target));
}

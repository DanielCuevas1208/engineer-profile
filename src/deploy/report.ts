import type { DeployResult } from "./local.js";
import type { DeployPreview } from "./preview.js";

export type DeployReportMode = "preview" | "sync";
export type DeployReportTarget = DeployPreview | DeployResult;

export interface DeployReport {
  formatVersion: 1;
  mode: DeployReportMode;
  generatedAt: string;
  outputDir: string;
  targets: DeployReportTarget[];
}

export function createDeployReport(
  mode: DeployReportMode,
  generatedAt: string,
  outputDir: string,
  targets: DeployReportTarget[]
): DeployReport {
  return {
    formatVersion: 1,
    mode,
    generatedAt,
    outputDir,
    targets,
  };
}

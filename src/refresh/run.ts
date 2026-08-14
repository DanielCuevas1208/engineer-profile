import { ingestOwnerRepos } from "../ingest/orchestrator.js";
import { captureAllProjects } from "../preview/capture.js";
import { publishSite, type PublishResult } from "../publish/site.js";
import { deployAll, type DeployResult } from "../deploy/index.js";
import type { FixtureData } from "../ingest/orchestrator.js";
import { DEFAULT_CONFIG, type PortfolioConfig } from "../types.js";

export interface RefreshOptions {
  fixtureRepos?: FixtureData[];
  capture?: boolean;
}

export interface RefreshResult {
  ingested: number;
  captured: number;
  copiedScreenshots: number;
  captureErrors: Array<{ slug: string; message: string }>;
  deployed: DeployResult[];
  published: PublishResult;
}

export async function refreshPortfolio(
  config: PortfolioConfig,
  options: RefreshOptions = {}
): Promise<RefreshResult> {
  const ingested = await ingestOwnerRepos(
    config,
    config.owner,
    config.repositoryLimit ?? DEFAULT_CONFIG.repositoryLimit,
    options.fixtureRepos
  );
  const captureErrors: Array<{ slug: string; message: string }> = [];
  const captured = options.capture === false
    ? []
    : await captureAllProjects(
        config,
        (_slug, homepage, repositoryUrl) => homepage ?? repositoryUrl,
        (slug, error) => captureErrors.push({ slug, message: error.message })
      );
  const published = publishSite(config);
  const deployed = deployAll(config);

  return {
    ingested: ingested.length,
    captured: captured.length,
    copiedScreenshots: published.copiedScreenshots,
    captureErrors,
    deployed,
    published,
  };
}

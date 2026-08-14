import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import {
  deployVercel,
  generateVercelConfig,
  previewVercel,
  type VercelConfig,
} from "../src/deploy/vercel.js";
import { ingestOwnerRepos } from "../src/ingest/orchestrator.js";
import { publishSite } from "../src/publish/site.js";
import { loadAllFixtures } from "../src/fixtures/loader.js";
import { DEFAULT_CONFIG, type PortfolioConfig, type VercelDeployTarget } from "../src/types.js";

const TEST_DATA = join("data", "test-vercel-deploy");
const TEST_OUTPUT = join("output", "test-vercel-deploy");
const TEST_STAGING = join("deploy", "test-vercel-staging");

describe("Vercel configuration generation", () => {
  it("generates valid vercel.json configuration", () => {
    const config = generateVercelConfig();
    expect(config.version).toBe(2);
    expect(config.cleanUrls).toBe(true);
    expect(config.trailingSlash).toBe(false);
    expect(config.headers?.length).toBeGreaterThan(0);

    const assetRule = config.headers?.find((h) => h.source === "/assets/(.*)");
    expect(assetRule).toBeDefined();
    expect(assetRule?.headers).toContainEqual({
      key: "Cache-Control",
      value: "public, max-age=31536000, immutable",
    });
  });

  it("respects cleanUrls and trailingSlash options", () => {
    const target: VercelDeployTarget = {
      name: "custom-vercel",
      type: "vercel",
      cleanUrls: false,
      trailingSlash: true,
    };
    const config = generateVercelConfig(target);
    expect(config.cleanUrls).toBe(false);
    expect(config.trailingSlash).toBe(true);
  });
});

describe("Vercel deploy pipeline", () => {
  beforeEach(async () => {
    rmSync(TEST_DATA, { recursive: true, force: true });
    rmSync(TEST_OUTPUT, { recursive: true, force: true });
    rmSync(TEST_STAGING, { recursive: true, force: true });

    const config: PortfolioConfig = {
      ...DEFAULT_CONFIG,
      dataDir: TEST_DATA,
      outputDir: TEST_OUTPUT,
      clock: () => "2026-08-01T00:00:00.000Z",
    };
    await ingestOwnerRepos(config, config.owner, 2, loadAllFixtures());
    publishSite(config);
  });

  afterEach(() => {
    rmSync(TEST_DATA, { recursive: true, force: true });
    rmSync(TEST_OUTPUT, { recursive: true, force: true });
    rmSync(TEST_STAGING, { recursive: true, force: true });
  });

  it("previews Vercel staging differences", () => {
    const config: PortfolioConfig = {
      ...DEFAULT_CONFIG,
      dataDir: TEST_DATA,
      outputDir: TEST_OUTPUT,
      clock: () => "2026-08-01T00:00:00.000Z",
    };
    const target: VercelDeployTarget = {
      name: "preview-vercel",
      type: "vercel",
      projectId: "prj_test123",
      target: TEST_STAGING,
    };

    const preview = previewVercel(config, target);
    expect(preview.targetName).toBe("preview-vercel");
    expect(preview.targetPath).toBe("vercel://prj_test123");
    expect(preview.status).toBe("changed");
    expect(preview.added).toContain("index.html");
  });

  it("deploys Vercel bundle with vercel.json", () => {
    const config: PortfolioConfig = {
      ...DEFAULT_CONFIG,
      dataDir: TEST_DATA,
      outputDir: TEST_OUTPUT,
      clock: () => "2026-08-01T00:00:00.000Z",
    };
    const target: VercelDeployTarget = {
      name: "prod-vercel",
      type: "vercel",
      projectId: "prj_prod456",
      target: TEST_STAGING,
    };

    const result = deployVercel(config, target);
    expect(result.targetName).toBe("prod-vercel");
    expect(result.targetPath).toBe("vercel://prj_prod456");
    expect(result.verified).toBe(true);
    expect(result.files).toBeGreaterThan(0);

    const vercelJsonPath = join(TEST_STAGING, "vercel.json");
    expect(existsSync(vercelJsonPath)).toBe(true);
    const vercelConfig = JSON.parse(readFileSync(vercelJsonPath, "utf-8")) as VercelConfig;
    expect(vercelConfig.version).toBe(2);
    expect(vercelConfig.cleanUrls).toBe(true);
  });
});

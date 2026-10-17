import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import {
  createS3SyncPlan,
  deployS3,
  inferCacheControl,
  inferContentType,
  previewS3,
  validateS3BucketName,
  type S3SyncPlan,
} from "../src/deploy/s3.js";
import { ingestOwnerRepos } from "../src/ingest/orchestrator.js";
import { publishSite } from "../src/publish/site.js";
import { loadAllFixtures } from "../src/fixtures/loader.js";
import { DEFAULT_CONFIG, type PortfolioConfig, type S3DeployTarget } from "../src/types.js";

const TEST_DATA = join("data", "test-s3-deploy");
const TEST_OUTPUT = join("output", "test-s3-deploy");
const TEST_STAGING = join("deploy", "test-s3-staging");

describe("S3 bucket validation", () => {
  it("accepts valid DNS-compliant S3 bucket names", () => {
    expect(validateS3BucketName("my-portfolio-bucket")).toBe(true);
    expect(validateS3BucketName("portfolio.engineer.io")).toBe(true);
    expect(validateS3BucketName("engineer-123")).toBe(true);
    expect(validateS3BucketName("a".repeat(63))).toBe(true);
  });

  it("rejects invalid bucket names", () => {
    expect(validateS3BucketName("ab")).toBe(false); // too short
    expect(validateS3BucketName("a".repeat(64))).toBe(false); // too long
    expect(validateS3BucketName("-leading-hyphen")).toBe(false);
    expect(validateS3BucketName("trailing-hyphen-")).toBe(false);
    expect(validateS3BucketName("uppercase-BUCKET")).toBe(false);
    expect(validateS3BucketName("consecutive..dots")).toBe(false);
    expect(validateS3BucketName("192.168.1.1")).toBe(false); // IP-formatted
  });
});

describe("MIME and caching rules", () => {
  it("infers accurate content types", () => {
    expect(inferContentType("index.html")).toBe("text/html; charset=utf-8");
    expect(inferContentType("style.css")).toBe("text/css; charset=utf-8");
    expect(inferContentType("feed.xml")).toBe("application/rss+xml; charset=utf-8");
    expect(inferContentType("site-manifest.json")).toBe("application/json; charset=utf-8");
    expect(inferContentType("preview.png")).toBe("image/png");
    expect(inferContentType("logo.svg")).toBe("image/svg+xml");
    expect(inferContentType("notes.md")).toBe("text/markdown; charset=utf-8");
    expect(inferContentType("unknown.bin")).toBe("application/octet-stream");
  });

  it("sets immutable caching for assets and revalidation for pages", () => {
    expect(inferCacheControl("assets/screenshots/demo.png")).toBe("public, max-age=31536000, immutable");
    expect(inferCacheControl("index.html")).toBe("public, max-age=0, must-revalidate");
    expect(inferCacheControl("feed.xml")).toBe("public, max-age=0, must-revalidate");
    expect(inferCacheControl("site-manifest.json")).toBe("public, max-age=0, must-revalidate");
  });
});

describe("S3 sync plan and deployment", () => {
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

  it("creates a deterministic S3 upload plan", () => {
    const target: S3DeployTarget = {
      name: "prod-s3",
      type: "s3",
      bucket: "portfolio-prod-bucket",
      prefix: "site",
      region: "us-west-2",
    };

    const plan = createS3SyncPlan(TEST_OUTPUT, target);
    expect(plan.bucket).toBe("portfolio-prod-bucket");
    expect(plan.region).toBe("us-west-2");
    expect(plan.prefix).toBe("site");
    expect(plan.targetUri).toBe("s3://portfolio-prod-bucket/site");
    expect(plan.fileCount).toBeGreaterThan(0);
    expect(plan.totalSize).toBeGreaterThan(0);
    expect(plan.sourceDigest).toMatch(/^[a-f0-9]{64}$/);

    const indexItem = plan.items.find((i) => i.relativePath === "index.html");
    expect(indexItem).toBeDefined();
    expect(indexItem?.s3Key).toBe("site/index.html");
    expect(indexItem?.contentType).toBe("text/html; charset=utf-8");
    expect(indexItem?.cacheControl).toBe("public, max-age=0, must-revalidate");
  });

  it("previews S3 deployment differences", () => {
    const config: PortfolioConfig = {
      ...DEFAULT_CONFIG,
      dataDir: TEST_DATA,
      outputDir: TEST_OUTPUT,
      clock: () => "2026-08-01T00:00:00.000Z",
    };
    const target: S3DeployTarget = {
      name: "preview-s3",
      type: "s3",
      bucket: "portfolio-preview-bucket",
      target: TEST_STAGING,
    };

    const preview = previewS3(config, target);
    expect(preview.targetName).toBe("preview-s3");
    expect(preview.targetPath).toBe("s3://portfolio-preview-bucket");
    expect(preview.status).toBe("changed");
    expect(preview.added).toContain("index.html");
    expect(preview.added).toContain("site-manifest.json");
    expect(preview.sourceDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(preview.targetDigest).toBeNull();
  });

  it("stages S3 deployment with sync plan and digest verification", () => {
    const config: PortfolioConfig = {
      ...DEFAULT_CONFIG,
      dataDir: TEST_DATA,
      outputDir: TEST_OUTPUT,
      clock: () => "2026-08-01T00:00:00.000Z",
    };
    const target: S3DeployTarget = {
      name: "stage-s3",
      type: "s3",
      bucket: "portfolio-stage-bucket",
      prefix: "v1",
      target: TEST_STAGING,
    };

    const result = deployS3(config, target);
    expect(result.targetName).toBe("stage-s3");
    expect(result.targetPath).toBe("s3://portfolio-stage-bucket/v1");
    expect(result.verified).toBe(true);
    expect(result.files).toBeGreaterThan(0);
    expect(result.sourceDigest).toMatch(/^[a-f0-9]{64}$/);

    const planPath = join(TEST_STAGING, "s3-sync-plan.json");
    expect(existsSync(planPath)).toBe(true);
    const plan = JSON.parse(readFileSync(planPath, "utf-8")) as S3SyncPlan;
    expect(plan.bucket).toBe("portfolio-stage-bucket");
    expect(plan.prefix).toBe("v1");
    expect(plan.items.length).toBe(result.files);

    // Second deployment should be clean
    const previewAfter = previewS3(config, target);
    expect(previewAfter.status).toBe("clean");
    expect(previewAfter.added).toHaveLength(0);
    expect(previewAfter.changed).toHaveLength(0);
  });
});

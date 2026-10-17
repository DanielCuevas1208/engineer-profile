import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import {
  deployNetlify,
  generateNetlifyHeaders,
  generateNetlifyRedirects,
  previewNetlify,
} from "../src/deploy/netlify.js";
import { ingestOwnerRepos } from "../src/ingest/orchestrator.js";
import { publishSite } from "../src/publish/site.js";
import { loadAllFixtures } from "../src/fixtures/loader.js";
import { DEFAULT_CONFIG, type NetlifyDeployTarget, type PortfolioConfig } from "../src/types.js";

const TEST_DATA = join("data", "test-netlify-deploy");
const TEST_OUTPUT = join("output", "test-netlify-deploy");
const TEST_STAGING = join("deploy", "test-netlify-staging");

describe("Netlify configuration generation", () => {
  it("generates standard security and caching headers in _headers", () => {
    const headers = generateNetlifyHeaders();
    expect(headers).toContain("/*");
    expect(headers).toContain("X-Frame-Options: DENY");
    expect(headers).toContain("X-Content-Type-Options: nosniff");
    expect(headers).toContain("/assets/*");
    expect(headers).toContain("Cache-Control: public, max-age=31536000, immutable");
    expect(headers).toContain("/*.html");
    expect(headers).toContain("Cache-Control: public, max-age=0, must-revalidate");
    expect(headers).toContain("/feed.xml");
    expect(headers).toContain("Content-Type: application/rss+xml; charset=utf-8");
  });

  it("supports custom Netlify header rules", () => {
    const target: NetlifyDeployTarget = {
      name: "custom-netlify",
      type: "netlify",
      headers: [
        {
          for: "/custom/*",
          values: { "X-Custom-Header": "value123" },
        },
      ],
    };
    const headers = generateNetlifyHeaders(target);
    expect(headers).toContain("/custom/*");
    expect(headers).toContain("X-Custom-Header: value123");
  });

  it("generates _redirects rules accurately", () => {
    const redirects = generateNetlifyRedirects([
      { from: "/old-path", to: "/new-path", status: 301 },
      { from: "/api/*", to: "https://api.example.com/:splat", status: 200, force: true },
    ]);
    expect(redirects).toContain("/old-path  /new-path  301");
    expect(redirects).toContain("/api/*  https://api.example.com/:splat  200!");
  });
});

describe("Netlify deploy pipeline", () => {
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

  it("previews Netlify staging differences", () => {
    const config: PortfolioConfig = {
      ...DEFAULT_CONFIG,
      dataDir: TEST_DATA,
      outputDir: TEST_OUTPUT,
      clock: () => "2026-08-01T00:00:00.000Z",
    };
    const target: NetlifyDeployTarget = {
      name: "preview-netlify",
      type: "netlify",
      siteId: "my-netlify-site-id",
      target: TEST_STAGING,
    };

    const preview = previewNetlify(config, target);
    expect(preview.targetName).toBe("preview-netlify");
    expect(preview.targetPath).toBe("netlify://my-netlify-site-id");
    expect(preview.status).toBe("changed");
    expect(preview.added).toContain("index.html");
  });

  it("deploys Netlify bundle with _headers and _redirects", () => {
    const config: PortfolioConfig = {
      ...DEFAULT_CONFIG,
      dataDir: TEST_DATA,
      outputDir: TEST_OUTPUT,
      clock: () => "2026-08-01T00:00:00.000Z",
    };
    const target: NetlifyDeployTarget = {
      name: "prod-netlify",
      type: "netlify",
      siteId: "prod-site-uuid",
      target: TEST_STAGING,
      redirects: [{ from: "/home", to: "/", status: 301 }],
    };

    const result = deployNetlify(config, target);
    expect(result.targetName).toBe("prod-netlify");
    expect(result.targetPath).toBe("netlify://prod-site-uuid");
    expect(result.verified).toBe(true);
    expect(result.files).toBeGreaterThan(0);

    expect(existsSync(join(TEST_STAGING, "_headers"))).toBe(true);
    expect(existsSync(join(TEST_STAGING, "_redirects"))).toBe(true);
    const redirects = readFileSync(join(TEST_STAGING, "_redirects"), "utf-8");
    expect(redirects).toContain("/home  /  301");
  });
});

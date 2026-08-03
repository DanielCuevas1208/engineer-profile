import { describe, expect, it, afterEach, beforeEach } from "vitest";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ingestOwnerRepos } from "../src/ingest/orchestrator.js";
import { publishSite } from "../src/publish/site.js";
import { loadAllFixtures } from "../src/fixtures/loader.js";
import { prepareDeployment } from "../src/deploy/run.js";
import { buildDeployPlan, deployAdapterIds, getAdapter, isValidAdapterId } from "../src/deploy/adapters.js";
import { loadPortfolioConfig } from "../src/config/loader.js";
import { DEFAULT_CONFIG } from "../src/types.js";

const TEST_DATA = join("data", "test-deploy");
const TEST_OUTPUT = join("output", "test-deploy");

beforeEach(() => {
  rmSync(TEST_DATA, { recursive: true, force: true });
  rmSync(TEST_OUTPUT, { recursive: true, force: true });
});

afterEach(() => {
  rmSync(TEST_DATA, { recursive: true, force: true });
  rmSync(TEST_OUTPUT, { recursive: true, force: true });
});

describe("deployment adapter registry", () => {
  it("exposes the three built-in adapters", () => {
    expect(deployAdapterIds().sort()).toEqual(["github-pages", "netlify", "vercel"]);
    expect(isValidAdapterId("github-pages")).toBe(true);
    expect(getAdapter("vercel").label).toBe("Vercel");
  });

  it("rejects unknown adapters with a list of choices", () => {
    expect(() => getAdapter("surge")).toThrow(
      'Unknown deployment adapter "surge". Use one of: github-pages, netlify, vercel.'
    );
  });

  it("builds deterministic files for each adapter", () => {
    const netlify = buildDeployPlan("netlify", {});
    expect(netlify.files).toHaveLength(1);
    expect(netlify.files[0].path).toBe("netlify.toml");
    expect(netlify.files[0].contents).toContain("publish = \".\"");

    const vercel = buildDeployPlan("vercel", {});
    expect(vercel.files[0].path).toBe("vercel.json");
    expect(vercel.files[0].contents).toContain('"cleanUrls": true');

    const pages = buildDeployPlan("github-pages", {});
    expect(pages.files[0].path).toBe(".nojekyll");
  });

  it("writes a CNAME when a site URL is provided", () => {
    const plan = buildDeployPlan("github-pages", { siteUrl: "https://example.dev" });
    expect(plan.files.map((file) => file.path)).toEqual([".nojekyll", "CNAME"]);
    expect(plan.files[1].contents).toBe("example.dev\n");
  });

  it("provides instructions for every adapter", () => {
    for (const id of deployAdapterIds()) {
      expect(buildDeployPlan(id, {}).instructions.length).toBeGreaterThan(0);
    }
  });
});

describe("deployment preparation", () => {
  it("writes adapter files into the published output", async () => {
    const config = { ...DEFAULT_CONFIG, dataDir: TEST_DATA, outputDir: TEST_OUTPUT };
    await ingestOwnerRepos(config, config.owner, 2, loadAllFixtures());
    publishSite(config);

    const result = prepareDeployment(config, { adapter: "netlify" });
    expect(result.label).toBe("Netlify");
    expect(result.written).toHaveLength(1);
    expect(existsSync(join(TEST_OUTPUT, "netlify.toml"))).toBe(true);
    expect(readFileSync(join(TEST_OUTPUT, "netlify.toml"), "utf-8")).toContain("[build]");
  });

  it("uses the adapter configured in the checked-in file", async () => {
    const config = {
      ...DEFAULT_CONFIG,
      dataDir: TEST_DATA,
      outputDir: TEST_OUTPUT,
      deploy: { adapter: "vercel" },
    };
    await ingestOwnerRepos(config, config.owner, 2, loadAllFixtures());
    publishSite(config);

    const result = prepareDeployment(config);
    expect(result.adapterId).toBe("vercel");
    expect(existsSync(join(TEST_OUTPUT, "vercel.json"))).toBe(true);
  });

  it("fails before writing when no site has been published", () => {
    const config = { ...DEFAULT_CONFIG, dataDir: TEST_DATA, outputDir: TEST_OUTPUT };
    expect(() => prepareDeployment(config, { adapter: "github-pages" })).toThrow(
      "No published site was found"
    );
  });

  it("fails when no adapter is selected", () => {
    const config = { ...DEFAULT_CONFIG, dataDir: TEST_DATA, outputDir: TEST_OUTPUT };
    expect(() => prepareDeployment(config)).toThrow("No deployment adapter was configured");
  });
});

describe("deployment configuration validation", () => {
  function writeConfig(deploy: Record<string, unknown>): string {
    const dir = join("data", "test-deploy-config");
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    const path = join(dir, "portfolio.json");
    writeFileSync(path, JSON.stringify({ deploy }));
    return path;
  }

  it("loads a configured adapter and site URL", () => {
    const config = loadPortfolioConfig(
      writeConfig({ adapter: "github-pages", siteUrl: "https://docs.example.dev" }),
      () => "2026-07-31T00:00:00.000Z"
    );
    expect(config.deploy.adapter).toBe("github-pages");
    expect(config.deploy.siteUrl).toBe("https://docs.example.dev");
  });

  it("rejects an unknown adapter", () => {
    expect(() => loadPortfolioConfig(writeConfig({ adapter: "surge" }))).toThrow(
      'Configuration field "deploy.adapter" must be one of: github-pages, netlify, vercel.'
    );
  });
});

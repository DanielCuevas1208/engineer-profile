import { afterEach, describe, expect, it } from "vitest";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { deployLocal, runDeploys } from "../src/deploy/index.js";
import { loadAllFixtures } from "../src/fixtures/loader.js";
import { ingestOwnerRepos } from "../src/ingest/orchestrator.js";
import { publishSite } from "../src/publish/site.js";
import { DEFAULT_CONFIG } from "../src/types.js";

const TEST_DATA = join("data", "test-deploy");
const TEST_OUTPUT = join("output", "test-deploy");
const TEST_TARGET = join("output", "test-deploy-target");

afterEach(() => {
  rmSync(TEST_DATA, { recursive: true, force: true });
  rmSync(TEST_OUTPUT, { recursive: true, force: true });
  rmSync(TEST_TARGET, { recursive: true, force: true });
});

async function publishedConfig() {
  const config = {
    ...DEFAULT_CONFIG,
    dataDir: TEST_DATA,
    outputDir: TEST_OUTPUT,
    clock: () => "2026-07-31T00:00:00.000Z",
  };
  await ingestOwnerRepos(config, config.owner, 2, loadAllFixtures());
  return publishSite(config);
}

describe("site manifest", () => {
  it("writes a deploy manifest during publish", async () => {
    const result = await publishedConfig();
    const manifest = JSON.parse(readFileSync(result.manifestPath, "utf-8"));

    expect(manifest.formatVersion).toBe(1);
    expect(manifest.projectCount).toBe(2);
    expect(manifest.theme).toBe("deep-space");
    expect(manifest.generatedAt).toBe("2026-07-31T00:00:00.000Z");
    expect(manifest.files).toContain("index.html");
  });
});

describe("local deploy adapter", () => {
  it("copies the published site to a local target", async () => {
    await publishedConfig();
    const config = { ...DEFAULT_CONFIG, dataDir: TEST_DATA, outputDir: TEST_OUTPUT };

    const result = deployLocal(config, { name: "docs", type: "local", target: TEST_TARGET });

    expect(existsSync(join(TEST_TARGET, "index.html"))).toBe(true);
    expect(existsSync(join(TEST_TARGET, "site-manifest.json"))).toBe(true);
    expect(result.targetName).toBe("docs");
    expect(result.files).toBeGreaterThan(0);
  });

  it("runs every configured deploy target", async () => {
    await publishedConfig();
    const config = {
      ...DEFAULT_CONFIG,
      dataDir: TEST_DATA,
      outputDir: TEST_OUTPUT,
      deploy: { targets: [{ name: "docs", type: "local", target: TEST_TARGET }] },
    };

    const results = runDeploys(config);

    expect(results).toHaveLength(1);
    expect(results[0].targetPath).toBe(TEST_TARGET);
    expect(existsSync(join(TEST_TARGET, "index.html"))).toBe(true);
  });

  it("requires a published site before deploying", () => {
    const config = { ...DEFAULT_CONFIG, dataDir: TEST_DATA, outputDir: TEST_OUTPUT };

    expect(() => deployLocal(config, { name: "docs", type: "local", target: TEST_TARGET })).toThrow(
      /Run publish first/
    );
  });
});

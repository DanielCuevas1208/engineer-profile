import { afterEach, describe, expect, it } from "vitest";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { ingestOwnerRepos } from "../src/ingest/orchestrator.js";
import { publishSite } from "../src/publish/site.js";
import { deployAll, deployLocal } from "../src/deploy/local.js";
import { openDatabase } from "../src/db/client.js";
import { loadAllFixtures } from "../src/fixtures/loader.js";
import { DEFAULT_CONFIG } from "../src/types.js";

const TEST_DATA = "data/test-deploy";
const TEST_OUTPUT = "output/test-deploy";
const TEST_TARGET = "output/test-deploy-target";

afterEach(() => {
  for (const path of [TEST_DATA, TEST_OUTPUT, TEST_TARGET]) {
    rmSync(path, { recursive: true, force: true });
  }
});

describe("local deploy adapter", () => {
  it("copies the published site to a target directory", async () => {
    const config = {
      ...DEFAULT_CONFIG,
      dataDir: TEST_DATA,
      outputDir: TEST_OUTPUT,
      deploy: { targets: [{ name: "preview", type: "local" as const, target: TEST_TARGET }] },
    };
    await ingestOwnerRepos(config, "demo-engineer", 2, loadAllFixtures());
    publishSite(config);

    const results = deployAll(config);

    expect(results).toHaveLength(1);
    expect(results[0].targetName).toBe("preview");
    expect(existsSync(join(TEST_TARGET, "index.html"))).toBe(true);
    expect(existsSync(join(TEST_TARGET, "site-manifest.json"))).toBe(true);
    expect(results[0].files).toBeGreaterThan(0);
  });

  it("records the deploy in the audit log", async () => {
    const config = {
      ...DEFAULT_CONFIG,
      dataDir: TEST_DATA,
      outputDir: TEST_OUTPUT,
      deploy: { targets: [{ name: "preview", type: "local" as const, target: TEST_TARGET }] },
    };
    await ingestOwnerRepos(config, "demo-engineer", 2, loadAllFixtures());
    publishSite(config);
    deployAll(config);

    const database = openDatabase(TEST_DATA, config.clock);
    const log = database.getIngestLog(10);
    database.close();
    expect(log.some((entry) => entry.action === "deploy")).toBe(true);
  });

  it("throws when no published site exists", () => {
    const config = { ...DEFAULT_CONFIG, dataDir: TEST_DATA, outputDir: TEST_OUTPUT };
    expect(() => deployLocal(config, "preview", TEST_TARGET)).toThrow(/Run publish first/);
  });

  it("keeps the deployed manifest readable", async () => {
    const config = {
      ...DEFAULT_CONFIG,
      dataDir: TEST_DATA,
      outputDir: TEST_OUTPUT,
      deploy: { targets: [{ name: "preview", type: "local" as const, target: TEST_TARGET }] },
    };
    await ingestOwnerRepos(config, "demo-engineer", 2, loadAllFixtures());
    publishSite(config);
    deployAll(config);

    const manifest = JSON.parse(readFileSync(join(TEST_TARGET, "site-manifest.json"), "utf-8")) as {
      projectCount: number;
      files: string[];
    };
    expect(manifest.projectCount).toBe(2);
    expect(manifest.files).toContain("index.html");
    expect(manifest.files).toContain("site-manifest.json");
  });
});

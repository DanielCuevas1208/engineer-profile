import { afterEach, describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { deployPortfolio } from "../src/deploy/run.js";
import {
  isKnownAdapter,
  listAdapters,
  resolveAdapter,
} from "../src/deploy/adapters.js";
import { ingestOwnerRepos } from "../src/ingest/orchestrator.js";
import { publishSite } from "../src/publish/site.js";
import { loadAllFixtures } from "../src/fixtures/loader.js";
import { loadPortfolioConfig } from "../src/config/loader.js";
import { openDatabase } from "../src/db/client.js";
import { DEFAULT_CONFIG } from "../src/types.js";

const TEST_DATA = join("data", "test-deploy");
const TEST_OUTPUT = join("output", "test-deploy");
const TEST_TARGET = join("output", "test-deploy-target");
const TEST_DIR = join("data", "test-deploy-config");

function configFor(targetDir?: string) {
  return {
    ...DEFAULT_CONFIG,
    dataDir: TEST_DATA,
    outputDir: TEST_OUTPUT,
    deploy: { adapter: "local", targetDir },
    clock: () => "2026-01-01T00:00:00.000Z",
  };
}

async function seedSite() {
  const config = { ...DEFAULT_CONFIG, dataDir: TEST_DATA, outputDir: TEST_OUTPUT };
  await ingestOwnerRepos(config, config.owner, 2, loadAllFixtures());
  return publishSite(config);
}

afterEach(() => {
  rmSync(TEST_DATA, { recursive: true, force: true });
  rmSync(TEST_OUTPUT, { recursive: true, force: true });
  rmSync(TEST_TARGET, { recursive: true, force: true });
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe("deployment adapters", () => {
  it("recognizes and lists built-in adapters", () => {
    expect(listAdapters().sort()).toEqual(["local", "none"]);
    for (const name of listAdapters()) {
      expect(isKnownAdapter(name)).toBe(true);
    }
  });

  it("rejects unknown adapter names", () => {
    expect(() => resolveAdapter("gh-pages")).toThrow(/Unknown deployment adapter/);
  });
});

describe("deployPortfolio", () => {
  it("does nothing when the none adapter is configured", async () => {
    await seedSite();
    const config = {
      ...DEFAULT_CONFIG,
      dataDir: TEST_DATA,
      outputDir: TEST_OUTPUT,
      clock: () => "2026-01-01T00:00:00.000Z",
    };
    const result = deployPortfolio(config);
    expect(result.adapter).toBe("none");
    expect(result.target).toBeNull();
    expect(result.filesCopied).toBe(0);
  });

  it("copies the published site to a local target directory", async () => {
    await seedSite();
    const result = deployPortfolio(configFor(TEST_TARGET));

    expect(result.adapter).toBe("local");
    expect(result.filesCopied).toBeGreaterThan(0);
    expect(existsSync(join(TEST_TARGET, "index.html"))).toBe(true);
    expect(readFileSync(join(TEST_TARGET, "index.html"), "utf-8")).toContain("signal-router");
  });

  it("rejects a target that overlaps the output directory", async () => {
    await seedSite();
    expect(() => deployPortfolio(configFor(TEST_OUTPUT))).toThrow(/must not overlap/);
  });

  it("requires a target directory for the local adapter", async () => {
    await seedSite();
    expect(() => deployPortfolio(configFor())).toThrow(/targetDir/);
  });

  it("records a deploy operation in the audit log", async () => {
    await seedSite();
    deployPortfolio(configFor(TEST_TARGET));

    const db = openDatabase(TEST_DATA);
    try {
      const log = db.getIngestLog(5);
      const deploy = log.find((entry) => entry.action === "deploy");
      expect(deploy?.detail).toContain("local:");
      expect(deploy?.detail).toContain("files");
    } finally {
      db.close();
    }
  });
});

describe("deployment configuration", () => {
  it("loads a local adapter with a target directory", () => {
    mkdirSync(TEST_DIR, { recursive: true });
    const file = join(TEST_DIR, "portfolio.json");
    writeFileSync(file, JSON.stringify({ deploy: { adapter: "local", targetDir: "site" } }));

    const config = loadPortfolioConfig(file);
    expect(config.deploy.adapter).toBe("local");
    expect(config.deploy.targetDir).toBe("site");
  });

  it("defaults the adapter to none", () => {
    mkdirSync(TEST_DIR, { recursive: true });
    const file = join(TEST_DIR, "portfolio.json");
    writeFileSync(file, JSON.stringify({}));

    const config = loadPortfolioConfig(file);
    expect(config.deploy.adapter).toBe("none");
    expect(config.deploy.targetDir).toBeUndefined();
  });

  it("rejects an unknown adapter in the configuration file", () => {
    mkdirSync(TEST_DIR, { recursive: true });
    const file = join(TEST_DIR, "portfolio.json");
    writeFileSync(file, JSON.stringify({ deploy: { adapter: "ftp" } }));

    expect(() => loadPortfolioConfig(file)).toThrow(/must be one of/);
  });
});

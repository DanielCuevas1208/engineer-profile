import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { ingestRepository } from "../src/ingest/orchestrator.js";
import { publishSite } from "../src/publish/site.js";
import { loadFixtureRepo, loadFixtureCommits, loadFixtureReleases } from "../src/fixtures/loader.js";
import { DEFAULT_CONFIG, type PortfolioConfig } from "../src/types.js";

const TEST_DATA = join("data", "test-manifest");
const TEST_OUTPUT = join("output", "test-manifest");

function fixtureConfig(): PortfolioConfig {
  return {
    ...DEFAULT_CONFIG,
    dataDir: TEST_DATA,
    outputDir: TEST_OUTPUT,
    theme: { name: "paper", accent: "#0f6bbd" },
    clock: () => "2026-07-31T00:00:00.000Z",
  };
}

async function ingestSignalRouter(config: PortfolioConfig) {
  await ingestRepository(
    config,
    { owner: "demo-engineer", repo: "signal-router" },
    {
      repo: loadFixtureRepo("signal-router"),
      commits: loadFixtureCommits("signal-router"),
      releases: loadFixtureReleases("signal-router"),
    }
  );
}

describe("site manifest", () => {
  beforeEach(() => {
    rmSync(TEST_DATA, { recursive: true, force: true });
    rmSync(TEST_OUTPUT, { recursive: true, force: true });
  });

  afterEach(() => {
    rmSync(TEST_DATA, { recursive: true, force: true });
    rmSync(TEST_OUTPUT, { recursive: true, force: true });
  });

  it("writes a versioned manifest with published project facts", async () => {
    const config = fixtureConfig();
    await ingestSignalRouter(config);
    const result = publishSite(config);

    expect(existsSync(result.manifestPath)).toBe(true);
    const manifest = JSON.parse(readFileSync(result.manifestPath, "utf-8")) as {
      formatVersion: number;
      theme: { name: string; mode: string; accent: string; radius: string; font: string };
      projectCount: number;
      projects: Array<{ slug: string; url: string; changelogFile: string | null }>;
      files: string[];
      screenshots: string[];
    };

    expect(manifest.formatVersion).toBe(2);
    expect(manifest.theme.name).toBe("paper");
    expect(manifest.theme.mode).toBe("light");
    expect(manifest.theme.accent).toBe("#0f6bbd");
    expect(manifest.theme.radius).toBe("16px");
    expect(manifest.projectCount).toBe(1);
    expect(manifest.projects[0].slug).toBe("demo-engineer-signal-router");
    expect(manifest.projects[0].url).toBe("https://github.com/demo-engineer/signal-router");
    expect(manifest.projects[0].changelogFile).toBe("demo-engineer-signal-router-changelog.md");
    expect(manifest.files).toContain("index.html");
    expect(manifest.files).toContain("site-manifest.json");
    expect(manifest.files).toContain("theme-gallery.html");
    expect(Array.isArray(manifest.screenshots)).toBe(true);
  });

  it("produces a deterministic manifest for the same snapshot", async () => {
    const config = fixtureConfig();
    await ingestSignalRouter(config);
    publishSite(config);
    const first = readFileSync(join(TEST_OUTPUT, "site-manifest.json"), "utf-8");
    publishSite(config);
    const second = readFileSync(join(TEST_OUTPUT, "site-manifest.json"), "utf-8");
    expect(first).toBe(second);
  });

  it("reflects an empty portfolio with zero projects", async () => {
    const config = fixtureConfig();
    const result = publishSite(config);
    const manifest = JSON.parse(readFileSync(result.manifestPath, "utf-8")) as {
      formatVersion: number;
      projectCount: number;
    };
    expect(manifest.projectCount).toBe(0);
  });
});

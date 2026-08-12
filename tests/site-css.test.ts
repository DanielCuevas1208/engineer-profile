import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { ingestRepository } from "../src/ingest/orchestrator.js";
import { publishSite } from "../src/publish/site.js";
import { loadFixtureCommits, loadFixtureReleases, loadFixtureRepo } from "../src/fixtures/loader.js";
import { DEFAULT_CONFIG, type PortfolioConfig, type ThemeConfig } from "../src/types.js";

const TEST_DATA = join("data", "test-site-css");
const TEST_OUTPUT = join("output", "test-site-css");

function themedConfig(theme: ThemeConfig): PortfolioConfig {
  return {
    ...DEFAULT_CONFIG,
    dataDir: TEST_DATA,
    outputDir: TEST_OUTPUT,
    theme,
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

describe("generated site CSS", () => {
  beforeEach(() => {
    rmSync(TEST_DATA, { recursive: true, force: true });
    rmSync(TEST_OUTPUT, { recursive: true, force: true });
  });

  afterEach(() => {
    rmSync(TEST_DATA, { recursive: true, force: true });
    rmSync(TEST_OUTPUT, { recursive: true, force: true });
  });

  it("applies the theme font token to the page body", async () => {
    const config = themedConfig({ name: "deep-space" });
    await ingestSignalRouter(config);
    const result = publishSite(config);

    const html = readFileSync(result.indexPath, "utf-8");
    expect(html).toContain("font-family: var(--font);");
  });

  it("applies the theme radius token to project cards", async () => {
    const config = themedConfig({ name: "deep-space" });
    await ingestSignalRouter(config);
    const result = publishSite(config);

    const html = readFileSync(result.indexPath, "utf-8");
    const projectCardRule = html.slice(html.indexOf(".project-card"), html.indexOf(".project-card") + 400);
    expect(projectCardRule).toContain("border-radius: var(--radius);");
    expect(projectCardRule).not.toContain("border-radius: 16px");
  });

  it("applies the radius token to panel surfaces", async () => {
    const config = themedConfig({ name: "deep-space" });
    await ingestSignalRouter(config);
    const result = publishSite(config);

    const html = readFileSync(result.indexPath, "utf-8");
    for (const selector of [".hero-aside", ".audit-panel", ".trail-card"]) {
      const rule = html.slice(html.indexOf(selector), html.indexOf(selector) + 320);
      expect(rule).toContain("border-radius: var(--radius);");
    }
  });

  it("reflects radius and font overrides in the generated variables", async () => {
    const config = themedConfig({ name: "paper", radius: "20px", font: "Georgia, serif" });
    await ingestSignalRouter(config);
    const result = publishSite(config);

    const html = readFileSync(result.indexPath, "utf-8");
    expect(html).toContain("--radius: 20px;");
    expect(html).toContain("--font: Georgia, serif;");
    expect(html).toContain("color-scheme: light");
  });

  it("keeps the default radius and font in the base theme", async () => {
    const config = themedConfig({ name: "terminal" });
    await ingestSignalRouter(config);
    const result = publishSite(config);

    const html = readFileSync(result.indexPath, "utf-8");
    expect(html).toContain("--radius: 8px;");
    expect(html).toContain("--font:");
    expect(html).toContain("ui-monospace");
  });
});

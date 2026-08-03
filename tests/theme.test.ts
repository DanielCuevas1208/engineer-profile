import { describe, expect, it, afterEach, beforeEach } from "vitest";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ingestOwnerRepos } from "../src/ingest/orchestrator.js";
import { publishSite } from "../src/publish/site.js";
import { loadAllFixtures } from "../src/fixtures/loader.js";
import { loadPortfolioConfig } from "../src/config/loader.js";
import { getTheme, isValidThemeId, themeIds, THEMES } from "../src/theme/registry.js";
import { DEFAULT_CONFIG } from "../src/types.js";

const TEST_DATA = join("data", "test-theme");
const TEST_OUTPUT = join("output", "test-theme");

beforeEach(() => {
  rmSync(TEST_DATA, { recursive: true, force: true });
  rmSync(TEST_OUTPUT, { recursive: true, force: true });
});

afterEach(() => {
  rmSync(TEST_DATA, { recursive: true, force: true });
  rmSync(TEST_OUTPUT, { recursive: true, force: true });
});

describe("theme registry", () => {
  it("exposes the default theme and valid ids", () => {
    expect(isValidThemeId("midnight")).toBe(true);
    expect(themeIds().sort()).toEqual(["midnight", "paper", "terminal"]);
    expect(getTheme("midnight").label).toBe("Midnight");
  });

  it("defines distinct palettes for every theme", () => {
    const palettes = themeIds().map((id) => getTheme(id).tokens.accent);
    expect(new Set(palettes).size).toBe(themeIds().length);
    expect(themeIds().every((id) => THEMES[id].tokens.colorScheme.length > 0)).toBe(true);
  });

  it("rejects unknown theme ids", () => {
    expect(() => getTheme("missing")).toThrow("Unknown theme");
    expect(isValidThemeId("missing")).toBe(false);
  });
});

describe("theme-aware publishing", () => {
  async function publishWithTheme(theme: string): Promise<string> {
    const config = {
      ...DEFAULT_CONFIG,
      dataDir: TEST_DATA,
      outputDir: TEST_OUTPUT,
      theme,
      clock: () => "2026-07-31T00:00:00.000Z",
    };
    await ingestOwnerRepos(config, config.owner, 2, loadAllFixtures());
    const result = publishSite(config);
    return readFileSync(result.indexPath, "utf-8");
  }

  it("injects the selected theme tokens into the page", async () => {
    const html = await publishWithTheme("paper");
    expect(html).toContain("--ink: #f6f3ec");
    expect(html).toContain("color-scheme: light");
    expect(html).toContain('<meta name="theme-color" content="#f6f3ec" />');
  });

  it("keeps publishing deterministic for each theme", async () => {
    const first = await publishWithTheme("terminal");
    rmSync(TEST_DATA, { recursive: true, force: true });
    rmSync(TEST_OUTPUT, { recursive: true, force: true });
    const second = await publishWithTheme("terminal");
    expect(first).toBe(second);
  });
});

describe("theme configuration validation", () => {
  it("loads a configured theme", () => {
    const config = loadPortfolioConfig(
      fixtureConfig({ theme: "paper" }),
      () => "2026-07-31T00:00:00.000Z"
    );
    expect(config.theme).toBe("paper");
  });

  it("rejects an unknown theme with a list of choices", () => {
    expect(() => loadPortfolioConfig(fixtureConfig({ theme: "neon" })))
      .toThrow('Configuration field "theme" must be one of: midnight, paper, terminal.');
  });

  it("defaults to the built-in theme", () => {
    const config = loadPortfolioConfig(fixtureConfig({}), () => "2026-07-31T00:00:00.000Z");
    expect(config.theme).toBe("midnight");
  });
});

function fixtureConfig(overrides: Record<string, unknown>): string {
  const dir = join("data", "test-theme-config");
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const path = join(dir, "portfolio.json");
  writeFileSync(path, JSON.stringify(overrides));
  return path;
}

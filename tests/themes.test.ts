import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadPortfolioConfig } from "../src/config/loader.js";
import { ingestOwnerRepos } from "../src/ingest/orchestrator.js";
import { publishSite } from "../src/publish/site.js";
import {
  THEMES,
  availableThemeNames,
  isKnownTheme,
  resolveTheme,
} from "../src/publish/themes.js";
import { loadAllFixtures } from "../src/fixtures/loader.js";
import { DEFAULT_CONFIG } from "../src/types.js";

const TEST_DIR = join("data", "test-themes");
const TEST_FILE = join(TEST_DIR, "portfolio.json");
const DATA_A = join("data", "test-themes-a");
const DATA_B = join("data", "test-themes-b");
const OUTPUT_A = join("output", "test-themes-a");
const OUTPUT_B = join("output", "test-themes-b");

function fixedConfig(dataDir: string, outputDir: string, theme: string) {
  return {
    ...DEFAULT_CONFIG,
    dataDir,
    outputDir,
    theme,
    clock: () => "2026-07-31T00:00:00.000Z",
  };
}

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
  rmSync(DATA_A, { recursive: true, force: true });
  rmSync(DATA_B, { recursive: true, force: true });
  rmSync(OUTPUT_A, { recursive: true, force: true });
  rmSync(OUTPUT_B, { recursive: true, force: true });
});

describe("theme registry", () => {
  it("ships a default theme", () => {
    const theme = resolveTheme();
    expect(theme.name).toBe("default");
    expect(theme.colorScheme).toBe("dark");
  });

  it("exposes named themes", () => {
    expect(isKnownTheme("light")).toBe(true);
    expect(availableThemeNames()).toContain("light");
  });

  it("rejects unknown theme names", () => {
    expect(() => resolveTheme("neon")).toThrow(/Unknown theme "neon"/);
  });
});

describe("theme configuration", () => {
  it("accepts a known theme name", () => {
    mkdirSync(TEST_DIR, { recursive: true });
    writeFileSync(TEST_FILE, JSON.stringify({ theme: "light" }));
    const config = loadPortfolioConfig(TEST_FILE, () => "2026-07-31T00:00:00.000Z");
    expect(config.theme).toBe("light");
  });

  it("defaults to the default theme when omitted", () => {
    mkdirSync(TEST_DIR, { recursive: true });
    writeFileSync(TEST_FILE, JSON.stringify({ owner: "owner" }));
    const config = loadPortfolioConfig(TEST_FILE, () => "2026-07-31T00:00:00.000Z");
    expect(config.theme).toBe("default");
  });

  it("rejects unknown theme names", () => {
    mkdirSync(TEST_DIR, { recursive: true });
    writeFileSync(TEST_FILE, JSON.stringify({ theme: "neon" }));
    expect(() => loadPortfolioConfig(TEST_FILE)).toThrow(
      'Configuration field "theme" must be one of'
    );
  });
});

describe("theme publishing", () => {
  it("marks the page with the resolved theme", async () => {
    const config = fixedConfig(DATA_A, OUTPUT_A, "light");
    await ingestOwnerRepos(config, config.owner, 2, loadAllFixtures());
    const result = publishSite(config);
    const html = readFileSync(result.indexPath, "utf-8");
    expect(html).toContain('data-theme="light"');
  });

  it("applies light color variables", async () => {
    const config = fixedConfig(DATA_A, OUTPUT_A, "light");
    await ingestOwnerRepos(config, config.owner, 2, loadAllFixtures());
    publishSite(config);
    const html = readFileSync(join(OUTPUT_A, "index.html"), "utf-8");
    expect(html).toContain("color-scheme: light;");
    expect(html).toContain("--ink: #f4f6fa;");
  });

  it("keeps the default theme on the page by default", async () => {
    const config = fixedConfig(DATA_A, OUTPUT_A, "default");
    await ingestOwnerRepos(config, config.owner, 2, loadAllFixtures());
    publishSite(config);
    const html = readFileSync(join(OUTPUT_A, "index.html"), "utf-8");
    expect(html).toContain('data-theme="default"');
  });

  it("publishes identical HTML across runs for the same theme", async () => {
    const outputs = [];
    const runs = [
      [DATA_A, OUTPUT_A],
      [DATA_B, OUTPUT_B],
    ];
    for (const [dataDir, outputDir] of runs) {
      const config = fixedConfig(dataDir, outputDir, "light");
      await ingestOwnerRepos(config, config.owner, 2, loadAllFixtures());
      const result = publishSite(config);
      outputs.push(readFileSync(result.indexPath, "utf-8"));
    }
    expect(outputs[0]).toBe(outputs[1]);
  });
});

describe("theme metadata", () => {
  it("defines a label and description for each theme", () => {
    for (const theme of Object.values(THEMES)) {
      expect(theme.label.length).toBeGreaterThan(0);
      expect(theme.description.length).toBeGreaterThan(0);
    }
  });
});

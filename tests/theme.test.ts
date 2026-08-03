import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ingestOwnerRepos } from "../src/ingest/orchestrator.js";
import { publishSite } from "../src/publish/site.js";
import { loadAllFixtures } from "../src/fixtures/loader.js";
import { loadPortfolioConfig } from "../src/config/loader.js";
import {
  cssVariables,
  isKnownTheme,
  listThemeNames,
  resolveTheme,
} from "../src/theme/registry.js";
import { DEFAULT_CONFIG } from "../src/types.js";

const TEST_DATA = join("data", "test-theme");
const TEST_OUTPUT = join("output", "test-theme");
const TEST_DIR = join("data", "test-theme-config");

const REQUIRED_TOKENS = [
  "scheme",
  "bg",
  "panel-tint",
  "panel-a",
  "panel-b",
  "line",
  "line-soft",
  "text",
  "muted",
  "accent",
  "accent-soft",
  "accent-2",
  "accent-3",
  "glow",
  "shadow",
  "visual-bg",
  "visual-shade",
  "stripe",
  "tag-line",
  "code-bg",
  "sans",
  "mono",
];

afterEach(() => {
  rmSync(TEST_DATA, { recursive: true, force: true });
  rmSync(TEST_OUTPUT, { recursive: true, force: true });
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe("theme registry", () => {
  it("resolves the default theme by name", () => {
    expect(resolveTheme("aurora").name).toBe("aurora");
  });

  it("recognizes every built-in theme name", () => {
    for (const name of listThemeNames()) {
      expect(isKnownTheme(name)).toBe(true);
    }
  });

  it("rejects unknown theme names", () => {
    expect(() => resolveTheme("neon")).toThrow(/Unknown theme/);
  });

  it("defines the same color tokens for every theme", () => {
    for (const name of listThemeNames()) {
      const theme = resolveTheme(name);
      for (const token of REQUIRED_TOKENS) {
        expect(theme.variables[token], `${name} defines ${token}`).toBeDefined();
      }
    }
  });

  it("renders each theme token as a CSS custom property", () => {
    const theme = resolveTheme("aurora");
    const css = cssVariables(theme);
    expect(css).toContain("  --accent: #67b7ff;");
    expect(css).toContain("  --scheme: dark;");
  });
});

describe("theme configuration", () => {
  it("loads a valid theme from the configuration file", () => {
    mkdirSync(TEST_DIR, { recursive: true });
    const file = join(TEST_DIR, "portfolio.json");
    writeFileSync(file, JSON.stringify({ theme: "terminal" }));

    const config = loadPortfolioConfig(file, () => "2026-01-01T00:00:00.000Z");
    expect(config.theme).toBe("terminal");
  });

  it("rejects an unknown theme in the configuration file", () => {
    mkdirSync(TEST_DIR, { recursive: true });
    const file = join(TEST_DIR, "portfolio.json");
    writeFileSync(file, JSON.stringify({ theme: "neon" }));

    expect(() => loadPortfolioConfig(file)).toThrow(/must be one of/);
  });

  it("uses the default theme when none is configured", () => {
    mkdirSync(TEST_DIR, { recursive: true });
    const file = join(TEST_DIR, "portfolio.json");
    writeFileSync(file, JSON.stringify({ owner: "demo-engineer" }));

    const config = loadPortfolioConfig(file);
    expect(config.theme).toBe(DEFAULT_CONFIG.theme);
  });
});

describe("theme publishing", () => {
  async function publishWith(theme?: string) {
    const config = {
      ...DEFAULT_CONFIG,
      dataDir: TEST_DATA,
      outputDir: TEST_OUTPUT,
      theme: theme ?? DEFAULT_CONFIG.theme,
      clock: () => "2026-01-01T00:00:00.000Z",
    };
    await ingestOwnerRepos(config, config.owner, 2, loadAllFixtures());
    return publishSite(config);
  }

  it("publishes the default theme when none is configured", async () => {
    const result = await publishWith();
    expect(result.theme).toBe("aurora");
    const html = readFileSync(result.indexPath, "utf-8");
    expect(html).toContain('data-theme="aurora"');
  });

  it("publishes the configured theme", async () => {
    const result = await publishWith("terminal");
    expect(result.theme).toBe("terminal");
    const html = readFileSync(result.indexPath, "utf-8");
    expect(html).toContain('data-theme="terminal"');
    expect(html).toContain("--accent: #66ff8c;");
  });

  it("keeps the default site colors for the aurora theme", async () => {
    const result = await publishWith("aurora");
    const html = readFileSync(result.indexPath, "utf-8");
    expect(html).toContain("--bg: #08111f;");
    expect(html).toContain("--accent: #67b7ff;");
  });
});

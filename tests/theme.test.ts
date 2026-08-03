import { describe, expect, it, afterEach } from "vitest";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ingestOwnerRepos } from "../src/ingest/orchestrator.js";
import { publishSite } from "../src/publish/site.js";
import { loadAllFixtures } from "../src/fixtures/loader.js";
import { loadPortfolioConfig } from "../src/config/loader.js";
import { isKnownTheme, listThemeNames, resolveTheme } from "../src/theme/registry.js";
import { DEFAULT_CONFIG } from "../src/types.js";

const TEST_DATA = join("data", "test-theme");
const TEST_OUTPUT = join("output", "test-theme");

afterEach(() => {
  rmSync(TEST_DATA, { recursive: true, force: true });
  rmSync(TEST_OUTPUT, { recursive: true, force: true });
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
    const required = [
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
      "stripe",
      "tag-line",
      "code-bg",
      "sans",
      "mono",
    ];
    for (const name of listThemeNames()) {
      const theme = resolveTheme(name);
      for (const token of required) {
        expect(theme.variables[token], `${name} defines ${token}`).toBeDefined();
      }
    }
  });
});

describe("theme configuration", () => {
  it("loads a valid theme from the configuration file", () => {
    const dir = join("data", "test-theme-config");
    mkdirSync(dir, { recursive: true });
    const file = join(dir, "portfolio.json");
    writeFileSync(file, JSON.stringify({ theme: "terminal" }));

    const config = loadPortfolioConfig(file, () => "2026-01-01T00:00:00.000Z");
    expect(config.theme).toBe("terminal");
    rmSync(dir, { recursive: true, force: true });
  });

  it("rejects an unknown theme in the configuration file", () => {
    const dir = join("data", "test-theme-config-bad");
    mkdirSync(dir, { recursive: true });
    const file = join(dir, "portfolio.json");
    writeFileSync(file, JSON.stringify({ theme: "neon" }));

    expect(() => loadPortfolioConfig(file)).toThrow(/must be one of/);
    rmSync(dir, { recursive: true, force: true });
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
});

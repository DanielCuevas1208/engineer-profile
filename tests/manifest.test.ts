import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { ingestOwnerRepos } from "../src/ingest/orchestrator.js";
import { captureLocalHtml, closeBrowser } from "../src/preview/capture.js";
import { publishSite, type SiteManifest } from "../src/publish/site.js";
import { loadAllFixtures } from "../src/fixtures/loader.js";
import { DEFAULT_CONFIG } from "../src/types.js";

const TEST_DATA = join("data", "test-manifest");
const TEST_OUTPUT = join("output", "test-manifest");

function readManifest(): SiteManifest {
  return JSON.parse(readFileSync(join(TEST_OUTPUT, "site-manifest.json"), "utf-8")) as SiteManifest;
}

describe("site manifest", () => {
  beforeEach(() => {
    rmSync(TEST_DATA, { recursive: true, force: true });
    rmSync(TEST_OUTPUT, { recursive: true, force: true });
  });

  afterEach(async () => {
    rmSync(TEST_DATA, { recursive: true, force: true });
    rmSync(TEST_OUTPUT, { recursive: true, force: true });
    await closeBrowser();
  });

  it("records format, theme, and project counts", async () => {
    const config = {
      ...DEFAULT_CONFIG,
      dataDir: TEST_DATA,
      outputDir: TEST_OUTPUT,
      clock: () => "2026-07-31T00:00:00.000Z",
    };
    await ingestOwnerRepos(config, config.owner, 2, loadAllFixtures());
    const result = publishSite(config);

    expect(result.theme).toBe("deep-space");
    expect(result.manifestPath).toBe(join(TEST_OUTPUT, "site-manifest.json"));
    expect(existsSync(result.manifestPath)).toBe(true);

    const manifest = readManifest();
    expect(manifest.formatVersion).toBe(1);
    expect(manifest.theme).toBe("deep-space");
    expect(manifest.projectCount).toBe(2);
    expect(manifest.owner).toBe("demo-engineer");
    expect(manifest.generatedAt).toBe("2026-07-31T00:00:00.000Z");
    expect(manifest.files).toContain("index.html");
    expect(manifest.files).toContain("site-manifest.json");
    expect(manifest.files).toContain("demo-engineer-signal-router-changelog.md");
    expect(manifest.projects).toHaveLength(2);
  });

  it("lists screenshots after capture", async () => {
    const config = {
      ...DEFAULT_CONFIG,
      dataDir: TEST_DATA,
      outputDir: TEST_OUTPUT,
      clock: () => "2026-07-31T00:00:00.000Z",
    };
    await ingestOwnerRepos(config, config.owner, 2, loadAllFixtures());
    for (const fixture of loadAllFixtures()) {
      const slug = fixture.repo.full_name.replace(/\//g, "-").toLowerCase();
      await captureLocalHtml(config, slug, join("fixtures", "preview-pages", `${fixture.repo.name}.html`));
    }
    publishSite(config);

    const manifest = readManifest();
    expect(manifest.screenshots).toContain("assets/screenshots/demo-engineer-signal-router.png");
    expect(manifest.screenshots).toContain("assets/screenshots/demo-engineer-metrics-kit.png");
  });

  it("publishes with a custom theme", async () => {
    const config = {
      ...DEFAULT_CONFIG,
      dataDir: TEST_DATA,
      outputDir: TEST_OUTPUT,
      theme: { name: "paper" },
      clock: () => "2026-07-31T00:00:00.000Z",
    };
    await ingestOwnerRepos(config, config.owner, 2, loadAllFixtures());
    const result = publishSite(config);

    expect(result.theme).toBe("paper");
    expect(readManifest().theme).toBe("paper");
    const html = readFileSync(result.indexPath, "utf-8");
    expect(html).toContain("Theme / paper");
    expect(html).toContain("color-scheme: light");
  });
});

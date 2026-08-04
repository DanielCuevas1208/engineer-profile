import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ingestOwnerRepos } from "../src/ingest/orchestrator.js";
import { captureLocalHtml, closeBrowser } from "../src/preview/capture.js";
import { publishSite, copyScreenshotsToOutput } from "../src/publish/site.js";
import { loadAllFixtures } from "../src/fixtures/loader.js";
import { DEFAULT_CONFIG } from "../src/types.js";

const TEST_DATA = join("data", "test-demo");
const TEST_OUTPUT = join("output", "test-demo");

describe("demo pipeline", () => {
  beforeEach(() => {
    rmSync(TEST_DATA, { recursive: true, force: true });
    rmSync(TEST_OUTPUT, { recursive: true, force: true });
  });

  afterEach(async () => {
    rmSync(TEST_DATA, { recursive: true, force: true });
    rmSync(TEST_OUTPUT, { recursive: true, force: true });
    await closeBrowser();
  });

  it("runs ingest, capture, and publish without network", async () => {
    const config = { ...DEFAULT_CONFIG, dataDir: TEST_DATA, outputDir: TEST_OUTPUT };
    const fixtures = loadAllFixtures();

    const ingested = await ingestOwnerRepos(config, "demo-engineer", fixtures.length, fixtures);
    expect(ingested).toHaveLength(2);

    for (const f of fixtures) {
      const slug = f.repo.full_name.replace(/\//g, "-").toLowerCase();
      const htmlPath = join("fixtures", "preview-pages", `${f.repo.name}.html`);
      await captureLocalHtml(config, slug, htmlPath);
    }

    const published = publishSite(config);
    const copied = copyScreenshotsToOutput(config);

    expect(published.projectCount).toBe(2);
    expect(copied).toBe(2);
    expect(existsSync(published.indexPath)).toBe(true);

    const html = readFileSync(published.indexPath, "utf-8");
    expect(html).toContain("signal-router");
    expect(html).toContain("metrics-kit");
    expect(existsSync(join(TEST_OUTPUT, "demo-engineer-signal-router-changelog.md"))).toBe(true);
    expect(existsSync(join(TEST_OUTPUT, "assets", "screenshots", "demo-engineer-signal-router.png"))).toBe(true);

    const manifest = JSON.parse(readFileSync(published.manifestPath, "utf-8"));
    expect(manifest.files).toContain("assets/screenshots/demo-engineer-signal-router.png");
    expect(manifest.projectCount).toBe(2);
  });
});

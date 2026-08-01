import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { captureLocalHtml, closeBrowser } from "../src/preview/capture.js";
import { openDatabase } from "../src/db/client.js";
import { DEFAULT_CONFIG } from "../src/types.js";

const TEST_DATA = join("data", "test-capture");

describe("screenshot capture", () => {
  beforeEach(() => {
    rmSync(TEST_DATA, { recursive: true, force: true });
  });

  afterEach(async () => {
    rmSync(TEST_DATA, { recursive: true, force: true });
    await closeBrowser();
  });

  it("captures a PNG from local fixture HTML", async () => {
    const config = { ...DEFAULT_CONFIG, dataDir: TEST_DATA };
    const htmlPath = join("fixtures", "preview-pages", "signal-router.html");

    const path = await captureLocalHtml(config, "demo-engineer-signal-router", htmlPath);

    expect(existsSync(path)).toBe(true);
    expect(path).toMatch(/demo-engineer-signal-router\.png$/);
  });

  it("records screenshot path when project exists", async () => {
    const config = { ...DEFAULT_CONFIG, dataDir: TEST_DATA };
    const htmlPath = join("fixtures", "preview-pages", "metrics-kit.html");
    const slug = "demo-engineer-metrics-kit";

    const db = openDatabase(TEST_DATA);
    db.upsertProject({
      slug,
      name: "Metrics Kit",
      description: null,
      url: "https://github.com/demo-engineer/metrics-kit",
      homepage: null,
      language: "TypeScript",
      stars: 0,
      forks: 0,
      topics: "[]",
      last_pushed: "2026-01-01T00:00:00Z",
      visible: 1,
      screenshot_path: null,
      ingested_at: new Date().toISOString(),
    });
    db.close();

    const path = await captureLocalHtml(config, slug, htmlPath);
    const db2 = openDatabase(TEST_DATA);
    const project = db2.getProjectBySlug(slug);
    expect(project?.screenshot_path).toBe(path);
    db2.close();
  });
});

import { afterEach, describe, expect, it } from "vitest";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { loadAllFixtures } from "../src/fixtures/loader.js";
import { refreshPortfolio } from "../src/refresh/run.js";
import { DEFAULT_CONFIG } from "../src/types.js";

const TEST_DATA = join("data", "test-refresh");
const TEST_OUTPUT = join("output", "test-refresh");

afterEach(() => {
  rmSync(TEST_DATA, { recursive: true, force: true });
  rmSync(TEST_OUTPUT, { recursive: true, force: true });
});

describe("configured refresh", () => {
  it("ingests fixtures and publishes one complete snapshot", async () => {
    const config = {
      ...DEFAULT_CONFIG,
      dataDir: TEST_DATA,
      outputDir: TEST_OUTPUT,
      repositoryLimit: 2,
      clock: () => "2026-07-31T00:00:00.000Z",
    };

    const result = await refreshPortfolio(config, {
      fixtureRepos: loadAllFixtures(),
      capture: false,
    });

    expect(result.ingested).toBe(2);
    expect(result.captured).toBe(0);
    expect(result.captureErrors).toEqual([]);
    expect(result.published.projectCount).toBe(2);
    expect(result.copiedScreenshots).toBe(0);
    expect(existsSync(join(TEST_OUTPUT, "index.html"))).toBe(true);
  });
});

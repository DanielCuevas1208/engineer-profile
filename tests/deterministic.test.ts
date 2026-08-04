import { describe, expect, it, afterEach } from "vitest";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { ingestOwnerRepos } from "../src/ingest/orchestrator.js";
import { publishSite } from "../src/publish/site.js";
import { loadAllFixtures } from "../src/fixtures/loader.js";
import { DEFAULT_CONFIG } from "../src/types.js";

const RUNS = ["data/deterministic-a", "data/deterministic-b"];
const OUTPUTS = ["output/deterministic-a", "output/deterministic-b"];

function fixedConfig(dataDir: string, outputDir: string) {
  return {
    ...DEFAULT_CONFIG,
    dataDir,
    outputDir,
    clock: () => "2026-07-31T00:00:00.000Z",
  };
}

afterEach(() => {
  for (const path of [...RUNS, ...OUTPUTS]) rmSync(path, { recursive: true, force: true });
});

describe("deterministic publishing", () => {
  it("produces the same HTML for the same fixture snapshot", async () => {
    const fixtures = loadAllFixtures();
    const html = [];
    const manifests = [];
    for (let index = 0; index < RUNS.length; index++) {
      const config = fixedConfig(RUNS[index], OUTPUTS[index]);
      await ingestOwnerRepos(config, config.owner, fixtures.length, fixtures);
      const result = publishSite(config);
      html.push(readFileSync(result.indexPath, "utf-8"));
      manifests.push(readFileSync(result.manifestPath, "utf-8"));
    }

    expect(html[0]).toBe(html[1]);
    expect(manifests[0]).toBe(manifests[1]);
    expect(html[0]).toContain("2026-07-31 00:00:00 UTC");
  });

  it("keeps release source links in the published evidence trail", async () => {
    const config = fixedConfig(RUNS[0], OUTPUTS[0]);
    await ingestOwnerRepos(config, config.owner, 2, loadAllFixtures());
    const result = publishSite(config);
    const html = readFileSync(result.indexPath, "utf-8");

    expect(html).toContain("https://github.com/demo-engineer/signal-router/releases/tag/v0.3.0");
    expect(existsSync(join(OUTPUTS[0], "demo-engineer-signal-router-changelog.md"))).toBe(true);
  });
});
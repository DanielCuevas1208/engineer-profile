import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { ingestOwnerRepos, ingestRepository } from "../src/ingest/orchestrator.js";
import { publishSite } from "../src/publish/site.js";
import { loadAllFixtures, loadFixtureCommits, loadFixtureReleases, loadFixtureRepo } from "../src/fixtures/loader.js";
import { openDatabase } from "../src/db/client.js";
import { DEFAULT_CONFIG } from "../src/types.js";

const TEST_DATA = "data/test-evidence";
const TEST_OUTPUT = "output/test-evidence";

function fixedConfig() {
  return {
    ...DEFAULT_CONFIG,
    dataDir: TEST_DATA,
    outputDir: TEST_OUTPUT,
    clock: () => "2026-07-31T00:00:00.000Z",
  };
}

beforeEach(() => {
  rmSync(TEST_DATA, { recursive: true, force: true });
  rmSync(TEST_OUTPUT, { recursive: true, force: true });
});

afterEach(() => {
  rmSync(TEST_DATA, { recursive: true, force: true });
  rmSync(TEST_OUTPUT, { recursive: true, force: true });
});

describe("evidence pages", () => {
  it("writes one page per visible project with the full changelog", async () => {
    const config = fixedConfig();
    await ingestOwnerRepos(config, "demo-engineer", 2, loadAllFixtures());

    const result = publishSite(config);
    expect(result.evidencePages).toBe(2);

    const signalPath = join(TEST_OUTPUT, "demo-engineer-signal-router", "index.html");
    expect(existsSync(signalPath)).toBe(true);
    const html = readFileSync(signalPath, "utf-8");
    expect(html).toContain("signal-router");
    expect(html).toContain("Priority queues");
    expect(html).toContain("Typed channels");
    expect(html).toContain("View repository");
    expect(html).toContain("../index.html");
    expect(html).toContain("demo-engineer-signal-router-changelog.md");
  });

  it("links each index card to its evidence page", async () => {
    const config = fixedConfig();
    await ingestOwnerRepos(config, "demo-engineer", 2, loadAllFixtures());

    publishSite(config);
    const index = readFileSync(join(TEST_OUTPUT, "index.html"), "utf-8");
    expect(index).toContain('href="demo-engineer-signal-router/index.html"');
    expect(index).toContain('href="demo-engineer-metrics-kit/index.html"');
  });

  it("does not publish evidence pages for hidden projects", async () => {
    const config = fixedConfig();
    await ingestOwnerRepos(config, "demo-engineer", 2, loadAllFixtures());

    const db = openDatabase(TEST_DATA, config.clock);
    db.setVisibility("demo-engineer-metrics-kit", false);
    db.close();

    const result = publishSite(config);
    expect(result.evidencePages).toBe(1);
    expect(existsSync(join(TEST_OUTPUT, "demo-engineer-metrics-kit", "index.html"))).toBe(false);
  });

  it("writes a page for a project without changelog entries", async () => {
    const config = fixedConfig();
    await ingestRepository(
      config,
      { owner: "demo-engineer", repo: "signal-router" },
      {
        repo: loadFixtureRepo("signal-router"),
        commits: [],
        releases: [],
      }
    );

    const db = openDatabase(TEST_DATA, config.clock);
    db.replaceChangelog(db.getProjectBySlug("demo-engineer-signal-router")!.id, []);
    db.close();

    const result = publishSite(config);
    const page = readFileSync(
      join(TEST_OUTPUT, "demo-engineer-signal-router", "index.html"),
      "utf-8"
    );
    expect(result.evidencePages).toBe(1);
    expect(page).toContain("No changelog entries were found");
  });
});

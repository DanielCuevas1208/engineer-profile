import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { openDatabase } from "../src/db/client.js";
import { ingestRepository } from "../src/ingest/orchestrator.js";
import { publishSite, copyScreenshotsToOutput } from "../src/publish/site.js";
import { loadFixtureRepo, loadFixtureCommits, loadFixtureReleases } from "../src/fixtures/loader.js";
import { DEFAULT_CONFIG } from "../src/types.js";

const TEST_DATA = join("data", "test-run");
const TEST_OUTPUT = join("output", "test-run");

describe("database and publish pipeline", () => {
  beforeEach(() => {
    rmSync(TEST_DATA, { recursive: true, force: true });
    rmSync(TEST_OUTPUT, { recursive: true, force: true });
  });

  afterEach(() => {
    rmSync(TEST_DATA, { recursive: true, force: true });
    rmSync(TEST_OUTPUT, { recursive: true, force: true });
  });

  it("stores and retrieves projects", () => {
    const db = openDatabase(TEST_DATA);
    const project = db.upsertProject({
      slug: "test-project",
      name: "Test",
      description: "Desc",
      url: "https://github.com/o/test",
      homepage: null,
      language: "TypeScript",
      stars: 5,
      forks: 1,
      topics: "[]",
      last_pushed: "2026-01-01T00:00:00Z",
      visible: 1,
      screenshot_path: null,
      ingested_at: new Date().toISOString(),
    });
    expect(project.id).toBeGreaterThan(0);
    const fetched = db.getProjectBySlug("test-project");
    expect(fetched?.name).toBe("Test");
    db.close();
  });

  it("ingests fixture data end-to-end", async () => {
    const config = { ...DEFAULT_CONFIG, dataDir: TEST_DATA, outputDir: TEST_OUTPUT };
    const result = await ingestRepository(
      config,
      { owner: "demo-engineer", repo: "signal-router" },
      {
        repo: loadFixtureRepo("signal-router"),
        commits: loadFixtureCommits("signal-router"),
        releases: loadFixtureReleases("signal-router"),
      }
    );
    expect(result.slug).toBe("demo-engineer-signal-router");
    expect(result.changelogCount).toBe(2);

    const db = openDatabase(TEST_DATA);
    const commits = db.getCommits(db.getProjectBySlug(result.slug)!.id);
    expect(commits.length).toBeGreaterThan(0);
    db.close();
  });

  it("publishes static site with project cards", async () => {
    const config = { ...DEFAULT_CONFIG, dataDir: TEST_DATA, outputDir: TEST_OUTPUT };
    await ingestRepository(
      config,
      { owner: "demo-engineer", repo: "signal-router" },
      {
        repo: loadFixtureRepo("signal-router"),
        commits: loadFixtureCommits("signal-router"),
        releases: loadFixtureReleases("signal-router"),
      }
    );

    const result = publishSite(config);
    expect(result.projectCount).toBe(1);
    expect(existsSync(result.indexPath)).toBe(true);

    const html = readFileSync(result.indexPath, "utf-8");
    expect(html).toContain("signal-router");
    expect(html).toContain("auditable SQLite data");
    expect(html).toContain("42 stars");
    expect(html).toContain("total stars");
  });

  it("marks the published page with the configured theme", async () => {
    const config = {
      ...DEFAULT_CONFIG,
      dataDir: TEST_DATA,
      outputDir: TEST_OUTPUT,
      theme: { name: "terminal", customCss: null },
    };
    await ingestRepository(
      config,
      { owner: "demo-engineer", repo: "signal-router" },
      {
        repo: loadFixtureRepo("signal-router"),
        commits: loadFixtureCommits("signal-router"),
        releases: loadFixtureReleases("signal-router"),
      }
    );

    const result = publishSite(config);
    const html = readFileSync(result.indexPath, "utf-8");
    expect(html).toContain('data-theme="terminal"');
    expect(html).toContain("--font-mono");
  });

  it("respects visibility when publishing", async () => {
    const config = { ...DEFAULT_CONFIG, dataDir: TEST_DATA, outputDir: TEST_OUTPUT };
    await ingestRepository(
      config,
      { owner: "demo-engineer", repo: "signal-router" },
      {
        repo: loadFixtureRepo("signal-router"),
        commits: loadFixtureCommits("signal-router"),
        releases: loadFixtureReleases("signal-router"),
      }
    );

    const db = openDatabase(TEST_DATA);
    db.setVisibility("demo-engineer-signal-router", false);
    db.close();

    const result = publishSite(config);
    expect(result.projectCount).toBe(0);
    const html = readFileSync(result.indexPath, "utf-8");
    expect(html).not.toContain("Signal Router");
  });

  it("writes changelog markdown files", async () => {
    const config = { ...DEFAULT_CONFIG, dataDir: TEST_DATA, outputDir: TEST_OUTPUT };
    await ingestRepository(
      config,
      { owner: "demo-engineer", repo: "signal-router" },
      {
        repo: loadFixtureRepo("signal-router"),
        commits: loadFixtureCommits("signal-router"),
        releases: loadFixtureReleases("signal-router"),
      }
    );

    publishSite(config);
    const changelogPath = join(TEST_OUTPUT, "demo-engineer-signal-router-changelog.md");
    expect(existsSync(changelogPath)).toBe(true);
    const md = readFileSync(changelogPath, "utf-8");
    expect(md).toContain("v0.3.0");
  });

  it("publishes commit diff totals on project cards", async () => {
    const config = { ...DEFAULT_CONFIG, dataDir: TEST_DATA, outputDir: TEST_OUTPUT };
    await ingestRepository(
      config,
      { owner: "demo-engineer", repo: "signal-router" },
      {
        repo: loadFixtureRepo("signal-router"),
        commits: loadFixtureCommits("signal-router"),
        releases: loadFixtureReleases("signal-router"),
      }
    );

    const result = publishSite(config);
    const html = readFileSync(result.indexPath, "utf-8");
    expect(html).toContain("+131 added");
    expect(html).toContain("-21 removed");
    expect(html).toContain("diff-signal");
  });

  it("links the RSS feed from the page head", async () => {
    const config = { ...DEFAULT_CONFIG, dataDir: TEST_DATA, outputDir: TEST_OUTPUT };
    await ingestRepository(
      config,
      { owner: "demo-engineer", repo: "signal-router" },
      {
        repo: loadFixtureRepo("signal-router"),
        commits: loadFixtureCommits("signal-router"),
        releases: loadFixtureReleases("signal-router"),
      }
    );

    const result = publishSite(config);
    const html = readFileSync(result.indexPath, "utf-8");
    expect(html).toContain('rel="alternate" type="application/rss+xml"');
    expect(html).toContain('href="feed.xml"');
  });

  it("omits the feed link when the feed is disabled", async () => {
    const config = {
      ...DEFAULT_CONFIG,
      dataDir: TEST_DATA,
      outputDir: TEST_OUTPUT,
      feed: { ...DEFAULT_CONFIG.feed, enabled: false },
    };
    await ingestRepository(
      config,
      { owner: "demo-engineer", repo: "signal-router" },
      {
        repo: loadFixtureRepo("signal-router"),
        commits: loadFixtureCommits("signal-router"),
        releases: loadFixtureReleases("signal-router"),
      }
    );

    const result = publishSite(config);
    expect(result.feed).toBeNull();
    expect(existsSync(join(TEST_OUTPUT, "feed.xml"))).toBe(false);
    const html = readFileSync(result.indexPath, "utf-8");
    expect(html).not.toContain('type="application/rss+xml"');
  });
});

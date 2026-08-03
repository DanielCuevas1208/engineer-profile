import { afterEach, describe, expect, it } from "vitest";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { buildFeed, buildFeedItems, escapeXml, rfc822, type FeedItem } from "../src/publish/feed.js";
import { ingestOwnerRepos } from "../src/ingest/orchestrator.js";
import { publishSite } from "../src/publish/site.js";
import { loadAllFixtures } from "../src/fixtures/loader.js";
import { DEFAULT_CONFIG } from "../src/types.js";
import type { ChangelogEntry, ProjectRecord } from "../src/types.js";

const TEST_DATA = "data/test-feed";
const TEST_OUTPUT = "output/test-feed";

function fixedConfig() {
  return {
    ...DEFAULT_CONFIG,
    dataDir: TEST_DATA,
    outputDir: TEST_OUTPUT,
    clock: () => "2026-07-31T00:00:00.000Z",
  };
}

afterEach(() => {
  rmSync(TEST_DATA, { recursive: true, force: true });
  rmSync(TEST_OUTPUT, { recursive: true, force: true });
});

function viewFor(
  project: Partial<ProjectRecord>,
  entry: Partial<ChangelogEntry>
) {
  return {
    project: {
      id: 1,
      slug: "demo-project",
      name: "Demo",
      description: null,
      url: "https://github.com/demo-engineer/demo",
      homepage: null,
      language: "TypeScript",
      stars: 0,
      forks: 0,
      topics: "[]",
      last_pushed: "2026-01-01T00:00:00Z",
      visible: 1,
      screenshot_path: null,
      ingested_at: "2026-01-01T00:00:00Z",
      ...project,
    },
    evidence: { commits: 3, releases: 1 },
    changelog: [
      {
        id: 1,
        project_id: 1,
        version: "v1.0.0",
        title: "First release",
        body: "Initial notes",
        source: "release",
        source_url: "https://github.com/demo-engineer/demo/releases/tag/v1.0.0",
        published_at: "2026-07-14T10:00:00Z",
        commit_shas: "[]",
        ...entry,
      },
    ] as ChangelogEntry[],
  };
}

describe("feed primitives", () => {
  it("escapes XML-special characters", () => {
    expect(escapeXml(`A & B < "quoted" > 'x'`)).toBe(
      "A &amp; B &lt; &quot;quoted&quot; &gt; &#39;x&#39;"
    );
  });

  it("formats ISO dates as RFC 822", () => {
    expect(rfc822("2026-07-14T10:00:00Z")).toBe("Tue, 14 Jul 2026 10:00:00 GMT");
  });

  it("keeps the raw value when the date is invalid", () => {
    expect(rfc822("not-a-date")).toBe("not-a-date");
  });
});

describe("feed items", () => {
  it("sorts the latest entry of each project newest first", () => {
    const items = buildFeedItems([
      viewFor({ slug: "a", name: "Alpha" }, { published_at: "2026-07-01T00:00:00Z" }),
      viewFor({ slug: "b", name: "Beta" }, { published_at: "2026-07-20T00:00:00Z" }),
    ]);

    expect(items.map((item) => item.slug)).toEqual(["b", "a"]);
    expect(items[0].title).toBe("Beta: First release");
  });

  it("skips projects without changelog entries", () => {
    const view = viewFor({ slug: "a", name: "Alpha" });
    view.changelog = [];
    const items = buildFeedItems([view]);
    expect(items).toEqual([]);
  });

  it("uses the repository URL when a source link is missing", () => {
    const view = viewFor({ slug: "a", name: "Alpha" }, { source_url: null });
    const items = buildFeedItems([view]);
    expect(items[0].link).toBe("https://github.com/demo-engineer/demo");
  });
});

describe("feed integration", () => {
  it("writes feed.xml with one item per visible project", async () => {
    const config = fixedConfig();
    await ingestOwnerRepos(config, "demo-engineer", 2, loadAllFixtures());

    const result = publishSite(config);
    expect(result.feedPath).toBe(join(TEST_OUTPUT, "feed.xml"));
    expect(existsSync(result.feedPath!)).toBe(true);

    const feed = readFileSync(result.feedPath!, "utf-8");
    expect(feed).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(feed).toContain('<rss version="2.0"');
    expect(feed).toContain("<title>EngineerProfile / changelog</title>");
    expect(feed).toContain("signal-router: Priority queues");
    expect(feed).toContain("metrics-kit: Unreleased changes");
    expect(feed).toContain("https://github.com/demo-engineer/signal-router/releases/tag/v0.3.0");
    expect(feed).toContain("Tue, 14 Jul 2026 10:00:00 GMT");
    expect(feed).toContain("Mon, 20 Jul 2026 18:45:00 GMT");
  });

  it("keeps hidden projects out of the feed", async () => {
    const config = fixedConfig();
    await ingestOwnerRepos(config, "demo-engineer", 2, loadAllFixtures());

    const { openDatabase } = await import("../src/db/client.js");
    const db = openDatabase(TEST_DATA, config.clock);
    db.setVisibility("demo-engineer-signal-router", false);
    db.close();

    publishSite(config);
    const feed = readFileSync(join(TEST_OUTPUT, "feed.xml"), "utf-8");
    expect(feed).not.toContain("signal-router: Priority queues");
    expect(feed).toContain("metrics-kit: Unreleased changes");
  });

  it("writes an empty channel when no projects are visible", () => {
    const config = fixedConfig();
    const feed = buildFeed(config, [] as FeedItem[]);
    expect(feed).toContain("<channel>");
    expect(feed).not.toContain("<item>");
  });
});

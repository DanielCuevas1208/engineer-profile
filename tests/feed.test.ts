import { afterEach, describe, expect, it } from "vitest";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { loadAllFixtures } from "../src/fixtures/loader.js";
import { ingestOwnerRepos } from "../src/ingest/orchestrator.js";
import { openDatabase } from "../src/db/client.js";
import { publishSite } from "../src/publish/site.js";
import { buildRssXml, markdownToPlainText, toRfc1123, type FeedItem } from "../src/feed/rss.js";
import { DEFAULT_CONFIG } from "../src/types.js";

const TEST_DATA = join("data", "test-feed");
const TEST_OUTPUT = join("output", "test-feed");

afterEach(() => {
  rmSync(TEST_DATA, { recursive: true, force: true });
  rmSync(TEST_OUTPUT, { recursive: true, force: true });
});

function channel() {
  return {
    title: "EngineerProfile / release feed",
    link: "https://example.com/",
    description: "A living index of shipped systems",
    lastBuildDate: "2026-07-31T00:00:00.000Z",
  };
}

function sampleItem(): FeedItem {
  return {
    title: "Signal Router: Priority queues",
    link: "https://github.com/demo-engineer/signal-router/releases/tag/v0.3.0",
    guid: "https://github.com/demo-engineer/signal-router/releases/tag/v0.3.0",
    description: "Channel priority queues",
    publishedAt: "2026-07-14T10:00:00Z",
  };
}

describe("RSS feed helpers", () => {
  it("formats dates as RFC 1123 in UTC", () => {
    expect(toRfc1123("2026-07-14T10:00:00Z")).toBe("Tue, 14 Jul 2026 10:00:00 GMT");
  });

  it("keeps a plain string when the timestamp is invalid", () => {
    expect(toRfc1123("not-a-date")).toBe("not-a-date");
  });

  it("converts markdown to plain text", () => {
    expect(markdownToPlainText("## Features\n- one **two** `three`")).toBe("Features one two three");
  });
});

describe("buildRssXml", () => {
  it("produces deterministic RSS 2.0 output", () => {
    const first = buildRssXml(channel(), [sampleItem()]);
    const second = buildRssXml(channel(), [sampleItem()]);
    expect(first).toBe(second);
    expect(first).toContain('<rss version="2.0"');
    expect(first).toContain("<title>Signal Router: Priority queues</title>");
    expect(first).toContain("<pubDate>Tue, 14 Jul 2026 10:00:00 GMT</pubDate>");
    expect(first).toContain('<guid isPermaLink="false">');
  });

  it("escapes XML metacharacters in item content", () => {
    const item: FeedItem = {
      ...sampleItem(),
      title: "A & B <release>",
      link: "https://x.com/?a=1&b=2",
      description: "1 < 2 && 3 > 0",
    };
    const xml = buildRssXml(channel(), [item]);
    expect(xml).toContain("A &amp; B &lt;release&gt;");
    expect(xml).toContain("1 &lt; 2 &amp;&amp; 3 &gt; 0");
  });
});

describe("feed publishing", () => {
  it("writes feed.xml with one entry per visible project", async () => {
    const config = {
      ...DEFAULT_CONFIG,
      dataDir: TEST_DATA,
      outputDir: TEST_OUTPUT,
      clock: () => "2026-07-31T00:00:00.000Z",
    };
    await ingestOwnerRepos(config, "demo-engineer", 2, loadAllFixtures());

    const result = publishSite(config);
    expect(result.feed).not.toBeNull();
    expect(result.feed!.items).toBe(2);
    expect(existsSync(join(TEST_OUTPUT, "feed.xml"))).toBe(true);

    const xml = readFileSync(join(TEST_OUTPUT, "feed.xml"), "utf-8");
    expect(xml).toContain("signal-router: Priority queues");
    expect(xml).toContain("metrics-kit: Unreleased changes");
  });

  it("excludes hidden projects from the feed", async () => {
    const config = {
      ...DEFAULT_CONFIG,
      dataDir: TEST_DATA,
      outputDir: TEST_OUTPUT,
    };
    await ingestOwnerRepos(config, "demo-engineer", 2, loadAllFixtures());
    const db = openDatabase(TEST_DATA);
    db.setVisibility("demo-engineer-metrics-kit", false);
    db.close();

    publishSite(config);
    const xml = readFileSync(join(TEST_OUTPUT, "feed.xml"), "utf-8");
    expect(xml).toContain("signal-router");
    expect(xml).not.toContain("metrics-kit");
  });

  it("caps the number of feed entries", async () => {
    const config = {
      ...DEFAULT_CONFIG,
      dataDir: TEST_DATA,
      outputDir: TEST_OUTPUT,
      feed: { ...DEFAULT_CONFIG.feed, limit: 1 },
    };
    await ingestOwnerRepos(config, "demo-engineer", 2, loadAllFixtures());

    publishSite(config);
    const xml = readFileSync(join(TEST_OUTPUT, "feed.xml"), "utf-8");
    expect(xml.match(/<item>/g)).toHaveLength(1);
  });

  it("writes identical feed bytes for the same snapshot", async () => {
    const makeFeed = async () => {
      const config = {
        ...DEFAULT_CONFIG,
        dataDir: TEST_DATA,
        outputDir: TEST_OUTPUT,
        clock: () => "2026-07-31T00:00:00.000Z",
      };
      await ingestOwnerRepos(config, "demo-engineer", 2, loadAllFixtures());
      publishSite(config);
      return readFileSync(join(TEST_OUTPUT, "feed.xml"), "utf-8");
    };

    const first = await makeFeed();
    rmSync(TEST_DATA, { recursive: true, force: true });
    rmSync(TEST_OUTPUT, { recursive: true, force: true });
    const second = await makeFeed();
    expect(first).toBe(second);
  });
});

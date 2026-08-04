import { describe, expect, it } from "vitest";
import { renderRssFeed, toRfc2822, type RssItem } from "../src/publish/feed.js";

const channel = {
  title: "Evidence Index",
  link: "https://github.com/demo-engineer",
  description: "A living index of shipped systems",
  language: "en",
  lastBuildDate: "Wed, 29 Jul 2026 12:00:00 GMT",
  generator: "engineer-profile/0.5.0",
};

function item(overrides: Partial<RssItem> = {}): RssItem {
  return {
    title: "signal-router",
    link: "https://github.com/demo-engineer/signal-router",
    guid: "https://github.com/demo-engineer/signal-router#demo-engineer-signal-router",
    description: "Route events between services",
    pubDate: "Tue, 14 Jul 2026 10:00:00 GMT",
    categories: ["typescript", "messaging"],
    ...overrides,
  };
}

describe("renderRssFeed", () => {
  it("renders a valid RSS 2.0 document", () => {
    const xml = renderRssFeed(channel, [item()]);
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">');
    expect(xml).toContain("<title>Evidence Index</title>");
    expect(xml).toContain("<link>https://github.com/demo-engineer</link>");
    expect(xml).toContain("<lastBuildDate>Wed, 29 Jul 2026 12:00:00 GMT</lastBuildDate>");
    expect(xml).toContain("<item>");
    expect(xml).toContain("<guid isPermaLink=\"false\">");
    expect(xml).toContain("<category>typescript</category>");
    expect(xml).toContain("<category>messaging</category>");
  });

  it("escapes XML special characters", () => {
    const xml = renderRssFeed(channel, [
      item({
        title: "C++ & <Nodes>",
        description: 'He said "go" & ran <fast>',
        categories: ["a&b", "c<d"],
      }),
    ]);
    expect(xml).toContain("<title>C++ &amp; &lt;Nodes&gt;</title>");
    expect(xml).toContain("He said &quot;go&quot; &amp; ran &lt;fast&gt;");
    expect(xml).toContain("<category>a&amp;b</category>");
    expect(xml).toContain("<category>c&lt;d</category>");
  });

  it("sorts items by pubDate descending for deterministic output", () => {
    const first = renderRssFeed(channel, [
      item({ title: "older", pubDate: "Mon, 01 Jun 2026 08:00:00 GMT" }),
      item({ title: "newer", pubDate: "Wed, 15 Jul 2026 10:00:00 GMT" }),
    ]);
    expect(first.indexOf("newer")).toBeLessThan(first.indexOf("older"));
    const second = renderRssFeed(channel, [
      item({ title: "newer", pubDate: "Wed, 15 Jul 2026 10:00:00 GMT" }),
      item({ title: "older", pubDate: "Mon, 01 Jun 2026 08:00:00 GMT" }),
    ]);
    expect(first).toBe(second);
  });

  it("omits category tags when there are none", () => {
    const xml = renderRssFeed(channel, [item({ categories: [] })]);
    expect(xml).not.toContain("<category>");
  });
});

describe("toRfc2822", () => {
  it("converts ISO timestamps to UTC mail format", () => {
    expect(toRfc2822("2026-07-14T10:00:00Z")).toBe("Tue, 14 Jul 2026 10:00:00 GMT");
  });

  it("passes through unparseable values", () => {
    expect(toRfc2822("not-a-date")).toBe("not-a-date");
  });
});

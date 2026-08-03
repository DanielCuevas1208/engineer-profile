import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { safeExternalUrl, type ProjectView } from "./rendering.js";
import type { ChangelogEntry, PortfolioConfig } from "../types.js";

export interface FeedItem {
  slug: string;
  projectName: string;
  title: string;
  version: string;
  source: string;
  link: string;
  guid: string;
  publishedAt: string;
}

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function rfc822(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toUTCString();
}

function entryToItem(view: ProjectView, entry: ChangelogEntry): FeedItem | null {
  const fallbackLink = safeExternalUrl(view.project.url) ?? view.project.url;
  const link = safeExternalUrl(entry.source_url ?? view.project.url) ?? fallbackLink;
  return {
    slug: view.project.slug,
    projectName: view.project.name,
    title: `${view.project.name}: ${entry.title}`,
    version: entry.version,
    source: entry.source,
    link,
    guid: entry.source_url ?? `${view.project.slug}:${entry.version}`,
    publishedAt: entry.published_at,
  };
}

export function buildFeedItems(views: ProjectView[]): FeedItem[] {
  const items: FeedItem[] = [];
  for (const view of views) {
    const latest = view.changelog[0];
    if (!latest) continue;
    const item = entryToItem(view, latest);
    if (item) items.push(item);
  }
  return items.sort(
    (a, b) => b.publishedAt.localeCompare(a.publishedAt) || a.slug.localeCompare(b.slug)
  );
}

export function buildFeed(config: PortfolioConfig, items: FeedItem[]): string {
  const baseUrl = `https://github.com/${encodeURIComponent(config.owner)}`;
  const itemXml = items.map((item) => {
    const lines = [
      "    <item>",
      `      <title>${escapeXml(item.title)}</title>`,
      `      <link>${escapeXml(item.link)}</link>`,
      `      <guid isPermaLink="false">${escapeXml(item.guid)}</guid>`,
      `      <pubDate>${escapeXml(rfc822(item.publishedAt))}</pubDate>`,
      `      <description>${escapeXml(`${item.projectName} ${item.source} changelog entry ${item.version}`)}</description>`,
      "    </item>",
    ];
    return lines.join("\n");
  }).join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    "  <channel>",
    `    <title>${escapeXml(config.title)} / changelog</title>`,
    `    <link>${escapeXml(baseUrl)}</link>`,
    `    <description>${escapeXml(config.tagline)}</description>`,
    `    <atom:link href="${escapeXml(baseUrl)}" rel="self" type="application/rss+xml" />`,
    `    <lastBuildDate>${escapeXml(rfc822(config.clock()))}</lastBuildDate>`,
    itemXml,
    "  </channel>",
    "</rss>",
    "",
  ].join("\n");
}

export function writeFeed(config: PortfolioConfig, views: ProjectView[]): string {
  const feed = buildFeed(config, buildFeedItems(views));
  mkdirSync(config.outputDir, { recursive: true });
  const feedPath = join(config.outputDir, "feed.xml");
  writeFileSync(feedPath, feed, "utf-8");
  return feedPath;
}

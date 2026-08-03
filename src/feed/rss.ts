import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ChangelogEntry, PortfolioConfig, ProjectRecord } from "../types.js";

function loadHomepage(): string {
  try {
    const url = new URL("../../package.json", import.meta.url);
    const pkg = JSON.parse(readFileSync(url, "utf-8")) as { homepage?: string };
    return pkg.homepage ?? "https://github.com/";
  } catch {
    return "https://github.com/";
  }
}

const FALLBACK_HOMEPAGE = loadHomepage();

export interface FeedItem {
  title: string;
  link: string;
  guid: string;
  description: string;
  publishedAt: string;
}

export interface FeedChannel {
  title: string;
  link: string;
  description: string;
  lastBuildDate: string;
}

export interface FeedEntryInput {
  project: Pick<ProjectRecord, "slug" | "name" | "url">;
  changelog: ChangelogEntry[];
}

export interface FeedResult {
  path: string;
  items: number;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function toRfc1123(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return date.toUTCString();
}

export function markdownToPlainText(markdown: string): string {
  return markdown
    .split("\n")
    .map((line) =>
      line
        .replace(/^\s*#{1,6}\s*/, "")
        .replace(/^\s*[-*]\s+/, "")
        .replace(/`([^`]+)`/g, "$1")
        .replace(/\*\*([^*]+)\*\*/g, "$1")
        .trim()
    )
    .filter(Boolean)
    .join(" ");
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

function resolveFeedLink(config: PortfolioConfig): string {
  if (config.feed.siteUrl) return ensureTrailingSlash(config.feed.siteUrl);
  if (config.deployment.cname) return `https://${config.deployment.cname}/`;
  const clean = FALLBACK_HOMEPAGE.split("#")[0];
  return ensureTrailingSlash(clean);
}

export function buildRssXml(channel: FeedChannel, items: FeedItem[]): string {
  const itemXml = items
    .map(
      (item) => `    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${escapeXml(item.link)}</link>
      <guid isPermaLink="false">${escapeXml(item.guid)}</guid>
      <pubDate>${escapeXml(toRfc1123(item.publishedAt))}</pubDate>
      <description>${escapeXml(item.description)}</description>
    </item>`
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(channel.title)}</title>
    <link>${escapeXml(channel.link)}</link>
    <description>${escapeXml(channel.description)}</description>
    <language>en</language>
    <lastBuildDate>${escapeXml(toRfc1123(channel.lastBuildDate))}</lastBuildDate>
    <generator>engineer-profile</generator>
    <atom:link href="${escapeXml(channel.link)}feed.xml" rel="self" type="application/rss+xml" />
${itemXml}
  </channel>
</rss>
`;
}

function buildFeedItems(entries: FeedEntryInput[]): FeedItem[] {
  const items: FeedItem[] = [];
  for (const entry of entries) {
    const latest = entry.changelog[0];
    if (!latest) continue;
    items.push({
      title: `${entry.project.name}: ${latest.title}`,
      link: latest.source_url || entry.project.url,
      guid: latest.source_url || `${entry.project.url}#${latest.version}`,
      description: markdownToPlainText(latest.body),
      publishedAt: latest.published_at,
    });
  }
  return items.sort(
    (a, b) => b.publishedAt.localeCompare(a.publishedAt) || a.guid.localeCompare(b.guid)
  );
}

export function writeFeed(
  config: PortfolioConfig,
  entries: FeedEntryInput[]
): FeedResult {
  const items = buildFeedItems(entries).slice(0, config.feed.limit);
  const channel: FeedChannel = {
    title: `${config.title} / release feed`,
    link: resolveFeedLink(config),
    description: config.feed.description ?? config.tagline,
    lastBuildDate: config.clock(),
  };
  mkdirSync(config.outputDir, { recursive: true });
  const path = join(config.outputDir, "feed.xml");
  writeFileSync(path, buildRssXml(channel, items), "utf-8");
  return { path, items: items.length };
}

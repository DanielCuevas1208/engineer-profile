export interface RssChannel {
  title: string;
  link: string;
  description: string;
  language: string;
  lastBuildDate: string;
  generator: string;
}

export interface RssItem {
  title: string;
  link: string;
  guid: string;
  description: string;
  pubDate: string;
  categories: string[];
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function toRfc2822(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toUTCString();
}

export function renderRssFeed(channel: RssChannel, items: RssItem[]): string {
  const ordered = [...items].sort(
    (a, b) =>
      b.pubDate.localeCompare(a.pubDate) || a.guid.localeCompare(b.guid)
  );

  const lines: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    "  <channel>",
    `    <title>${escapeXml(channel.title)}</title>`,
    `    <link>${escapeXml(channel.link)}</link>`,
    `    <description>${escapeXml(channel.description)}</description>`,
    `    <language>${escapeXml(channel.language)}</language>`,
    `    <lastBuildDate>${escapeXml(channel.lastBuildDate)}</lastBuildDate>`,
    `    <generator>${escapeXml(channel.generator)}</generator>`,
    `    <atom:link href="${escapeXml(channel.link)}/feed.xml" rel="self" type="application/rss+xml" />`,
  ];

  for (const item of ordered) {
    lines.push("    <item>");
    lines.push(`      <title>${escapeXml(item.title)}</title>`);
    lines.push(`      <link>${escapeXml(item.link)}</link>`);
    lines.push(`      <guid isPermaLink="false">${escapeXml(item.guid)}</guid>`);
    lines.push(`      <pubDate>${escapeXml(item.pubDate)}</pubDate>`);
    for (const category of item.categories) {
      lines.push(`      <category>${escapeXml(category)}</category>`);
    }
    lines.push(`      <description>${escapeXml(item.description)}</description>`);
    lines.push("    </item>");
  }

  lines.push("  </channel>");
  lines.push("</rss>");
  return lines.join("\n") + "\n";
}

import { cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { formatChangelogMarkdown } from "../changelog/generator.js";
import { openDatabase } from "../db/client.js";
import { writeFeed } from "../feed/rss.js";
import { resolveThemeCss } from "../theme/resolve.js";
import type { ChangelogEntry, PortfolioConfig, ProjectRecord } from "../types.js";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeExternalUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? value : null;
  } catch {
    return null;
  }
}

function inlineMarkdown(text: string): string {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}

function markdownToHtml(markdown: string): string {
  const blocks: string[] = [];
  for (const line of markdown.split("\n")) {
    if (line.startsWith("### ")) {
      blocks.push(`<h4>${inlineMarkdown(line.slice(4))}</h4>`);
    } else if (line.startsWith("## ")) {
      blocks.push(`<h3>${inlineMarkdown(line.slice(3))}</h3>`);
    } else if (line.startsWith("# ")) {
      blocks.push(`<h2>${inlineMarkdown(line.slice(2))}</h2>`);
    } else if (line.startsWith("- ")) {
      blocks.push(`<li>${inlineMarkdown(line.slice(2))}</li>`);
    } else if (line.trim()) {
      blocks.push(`<p>${inlineMarkdown(line)}</p>`);
    }
  }
  return blocks.join("\n");
}

function parseTopics(value: string): string[] {
  try {
    const topics = JSON.parse(value) as unknown;
    return Array.isArray(topics) ? topics.filter((topic): topic is string => typeof topic === "string") : [];
  } catch {
    return [];
  }
}

function publicAuditDetail(detail: string | null): string {
  if (!detail) return "No detail recorded";
  const separator = detail.indexOf(" -> ");
  return separator >= 0 ? `${detail.slice(0, separator)} -> local artifact` : detail;
}

function displayDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

interface ProjectEvidence {
  commits: number;
  releases: number;
  diff: {
    commits: number;
    additions: number;
    deletions: number;
    changes: number;
    files: number;
  };
}

function projectCard(
  project: ProjectRecord,
  changelog: ChangelogEntry[],
  evidence: ProjectEvidence
): string {
  const topics = parseTopics(project.topics)
    .map((topic) => `<span class="tag">${escapeHtml(topic)}</span>`)
    .join("");
  const repositoryUrl = safeExternalUrl(project.url) ?? "#";
  const homepageUrl = safeExternalUrl(project.homepage);
  const latest = changelog[0];
  const sourceUrl = safeExternalUrl(latest?.source_url ?? null) ?? repositoryUrl;
  const sourceLabel = latest?.source === "release" ? "Read release" : "Inspect commits";
  const preview = latest
    ? markdownToHtml(latest.body.split("\n").slice(0, 8).join("\n"))
    : '<p class="muted">No changelog entry was found.</p>';
  const screenshot = project.screenshot_path
    ? `<img src="assets/screenshots/${escapeHtml(project.slug)}.png" alt="Preview of ${escapeHtml(project.name)}" class="screenshot" loading="lazy" />`
    : `<div class="screenshot placeholder"><span>Preview pending</span><small>Capture with Playwright</small></div>`;
  const diffSignal = evidence.diff.additions > 0 || evidence.diff.deletions > 0
    ? `<div class="diff-signal" aria-label="Commit diff summary">
        <span class="diff-added">+${evidence.diff.additions} added</span>
        <span class="diff-removed">-${evidence.diff.deletions} removed</span>
        <span class="diff-files">${evidence.diff.commits} commits</span>
      </div>`
    : "";

  return `<article class="project-card" id="${escapeHtml(project.slug)}">
    <div class="project-visual">${screenshot}<span class="visual-label">Preview / 1280 x 720</span></div>
    <div class="project-body">
      <div class="card-topline"><span>Project / ${escapeHtml(project.language ?? "Repository")}</span><span>${displayDate(project.last_pushed)}</span></div>
      <h2><a href="${escapeHtml(repositoryUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(project.name)}</a></h2>
      <p class="description">${escapeHtml(project.description ?? "No description provided by the repository.")}</p>
      <div class="facts" aria-label="Repository facts">
        <span aria-label="${project.stars} stars"><strong>${project.stars}</strong> stars</span>
        <span><strong>${project.forks}</strong> forks</span>
        <span><strong>${evidence.commits}</strong> commits</span>
      </div>
      ${diffSignal}
      ${topics ? `<div class="tags">${topics}</div>` : ""}
      <section class="change-log" aria-label="Latest changelog">
        <div class="section-heading"><span>Latest signal</span><span class="source-badge">${latest?.source ?? "pending"}</span></div>
        ${latest ? `<h3>${escapeHtml(latest.title)}</h3><p class="change-date">${displayDate(latest.published_at)} / ${evidence.releases} release notes</p>` : ""}
        <div class="change-preview">${preview}</div>
        <a class="text-link" href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener noreferrer">${sourceLabel} <span aria-hidden="true">-&gt;</span></a>
      </section>
      <div class="card-actions">
        <a class="button primary" href="${escapeHtml(repositoryUrl)}" target="_blank" rel="noopener noreferrer">View repository</a>
        ${homepageUrl ? `<a class="button secondary" href="${escapeHtml(homepageUrl)}" target="_blank" rel="noopener noreferrer">Open homepage</a>` : ""}
      </div>
    </div>
  </article>`;
}

export interface PublishResult {
  indexPath: string;
  projectCount: number;
  generatedAt: string;
  feed: { path: string; items: number } | null;
}

export function publishSite(config: PortfolioConfig): PublishResult {
  const db = openDatabase(config.dataDir, config.clock);
  try {
    const projects = db.listProjects(true);
    const generatedAt = config.clock();
    const views = projects.map((project) => ({
      project,
      changelog: db.getChangelog(project.id),
      evidence: {
        commits: db.countCommits(project.id),
        releases: db.countReleases(project.id),
        diff: db.getDiffSummary(project.id),
      },
    }));
    const totalStars = projects.reduce((sum, project) => sum + project.stars, 0);
    const totalCommits = views.reduce((sum, view) => sum + view.evidence.commits, 0);
    const releaseNotes = views.reduce((sum, view) => sum + view.evidence.releases, 0);
    const languages = [...new Set(projects.map((project) => project.language).filter(Boolean))] as string[];
    const auditLog = db.getIngestLog(5);
    const auditItems = auditLog.length
      ? auditLog.map((entry) => `<li><time>${escapeHtml(entry.created_at.slice(0, 16).replace("T", " "))}</time><strong>${escapeHtml(entry.action)}</strong><span>${escapeHtml(publicAuditDetail(entry.detail))}</span></li>`).join("")
      : '<li><span>No operations recorded yet.</span></li>';
    const cards = views.map((view) => projectCard(view.project, view.changelog, view.evidence)).join("\n");
    const visibleProjects = projects.length === 0
      ? '<div class="hero-aside"><div class="aside-index"><span>Portfolio / 00</span><span>Empty</span></div><p>No visible projects are ready. Run ingest, then publish again.</p></div>'
      : "";
    const { css: themeCss, name: themeName } = resolveThemeCss(config.theme);
    const feedLink = config.feed.enabled
      ? `<link rel="alternate" type="application/rss+xml" title="${escapeHtml(config.title)} release feed" href="feed.xml" />\n  `
      : "";

    const html = `<!DOCTYPE html>
<html lang="en" data-theme="${escapeHtml(themeName)}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="description" content="${escapeHtml(config.tagline)}" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; img-src 'self' data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'" />
  ${feedLink}<title>${escapeHtml(config.title)} / Portfolio</title>
  <style>${themeCss}</style>
</head>
<body>
  <div class="site-shell">
    <div class="container">
      <nav class="site-nav" aria-label="Primary navigation">
        <a class="brand" href="#top"><span class="brand-mark">EP</span><span>${escapeHtml(config.title)}</span></a>
        <a class="nav-link" href="#source-trail">Source trail -&gt;</a>
      </nav>
      <header class="hero" id="top">
        <div>
          <p class="kicker">Public repository signal / 01</p>
          <h1>Evidence before adjectives.</h1>
          <p class="hero-copy">${escapeHtml(config.tagline)}. Each project stays connected to its repository, commits, releases, and preview.</p>
        </div>
        <aside class="hero-aside">
          <div class="aside-index"><span>Profile / ${escapeHtml(config.owner)}</span><span>Local build</span></div>
          <p>Facts stay close to their sources. Privacy choices stay close to the database.</p>
        </aside>
      </header>
      <section class="stats-grid" aria-label="Portfolio totals">
        <div class="stat"><strong>${projects.length}</strong><span>visible projects</span></div>
        <div class="stat"><strong>${totalStars}</strong><span>total stars</span></div>
        <div class="stat"><strong>${totalCommits}</strong><span>commits tracked</span></div>
        <div class="stat"><strong>${releaseNotes}</strong><span>release notes</span></div>
      </section>
      <section class="audit-panel" aria-label="Data audit status">
        <div class="audit-copy"><strong>Auditable snapshot.</strong> Sourced from public repository metadata, commits, and releases. Source: auditable SQLite data. ${languages.length ? `Languages: ${languages.map(escapeHtml).join(", ")}.` : "No language data was provided."}</div>
        <div class="audit-time">Generated ${escapeHtml(generatedAt.slice(0, 19).replace("T", " "))} UTC<br />Emails redacted / hidden projects excluded</div>
      </section>
      <main>
        <div class="index-header"><div><p class="eyebrow">Portfolio / 02</p><h2>Project index</h2></div><p>Visible projects only. Every number comes from stored repository data.</p></div>
        ${visibleProjects}
        ${cards}
      </main>
      <section class="source-trail" id="source-trail">
        <div><p class="eyebrow">Audit / 03</p><h2>Refresh trail</h2><p>EngineerProfile records each ingest, capture, and publish operation locally.</p></div>
        <ol class="audit-list">${auditItems}</ol>
      </section>
      <footer class="site-footer"><p>${escapeHtml(config.title)} / local publisher</p><p>Public output contains visible projects only. No invented metrics.</p></footer>
    </div>
  </div>
</body>
</html>`;

    mkdirSync(config.outputDir, { recursive: true });
    const indexPath = join(config.outputDir, "index.html");
    writeFileSync(indexPath, html, "utf-8");

    for (const view of views) {
      if (view.changelog.length === 0) continue;
      const markdown = formatChangelogMarkdown(
        view.changelog.map((entry) => ({
          version: entry.version,
          title: entry.title,
          body: entry.body,
          source: entry.source,
          source_url: entry.source_url,
          published_at: entry.published_at,
          commit_shas: JSON.parse(entry.commit_shas) as string[],
        }))
      );
      writeFileSync(join(config.outputDir, `${view.project.slug}-changelog.md`), markdown, "utf-8");
    }

    const feed = config.feed.enabled ? writeFeed(config, views) : null;

    db.logIngest("publish", `${projects.length} projects -> ${indexPath}`);
    return { indexPath, projectCount: projects.length, generatedAt, feed };
  } finally {
    db.close();
  }
}

export function copyScreenshotsToOutput(config: PortfolioConfig): number {
  const assetsDir = join(config.outputDir, "assets", "screenshots");
  mkdirSync(assetsDir, { recursive: true });

  const db = openDatabase(config.dataDir, config.clock);
  let copied = 0;
  try {
    for (const project of db.listProjects(true)) {
      if (!project.screenshot_path || !existsSync(project.screenshot_path)) continue;
      cpSync(project.screenshot_path, join(assetsDir, `${project.slug}.png`));
      copied++;
    }
  } finally {
    db.close();
  }
  return copied;
}

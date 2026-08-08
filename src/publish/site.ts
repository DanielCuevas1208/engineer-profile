import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { formatChangelogMarkdown } from "../changelog/generator.js";
import {
  describeDiffCounts,
  formatCommitDiffMarkdown,
  summarizeCommitDiffs,
  UNRELEASED_VERSION,
  type CommitDiffSummary,
} from "../changelog/diff.js";
import { openDatabase } from "../db/client.js";
import { resolveTheme, themeVariables, type ThemeTokens } from "../theme/palette.js";
import { builtinGalleryThemes, renderThemeGallery } from "../theme/gallery.js";
import { renderRssFeed, toRfc2822 } from "./feed.js";
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

function plainText(markdown: string): string {
  return markdown
    .replace(/```[^`]*```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/[*_~#]/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
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
}

interface ProjectView {
  project: ProjectRecord;
  changelog: ChangelogEntry[];
  evidence: ProjectEvidence;
  diffs: CommitDiffSummary[];
}

function commitTrailSummary(summary: CommitDiffSummary): string {
  const versionLabel =
    summary.version === UNRELEASED_VERSION
      ? "Unreleased"
      : `${summary.title} (${summary.version})`;
  return `<div class="trail-summary">
      <span class="trail-version">${escapeHtml(versionLabel)}</span>
      <span>${summary.commits.length} ${pluralize(summary.commits.length, "commit", "commits")} / ${escapeHtml(describeDiffCounts(summary.counts))}</span>
    </div>`;
}

function commitTrailSection(views: ProjectView[]): string {
  const withDiffs = views.filter((view) => view.diffs.length > 0);
  const header = `<div class="index-header"><div><p class="eyebrow">Evidence / 03</p><h2>Commit trail</h2></div><p>Commit-diff summaries map stored commits to release windows.</p></div>`;
  if (withDiffs.length === 0) {
    return `<section class="commit-trail" id="commit-trail">
    ${header}
    <p class="muted">No commit activity is recorded yet. Run ingest, then publish again.</p>
  </section>`;
  }
  const cards = withDiffs
    .map((view) => {
      const summaries = view.diffs
        .slice(0, 4)
        .map(commitTrailSummary)
        .join("\n");
      return `<article class="trail-card">
      <div class="trail-topline"><span>Project / ${escapeHtml(view.project.language ?? "Repository")}</span><span>${view.diffs.length} ${pluralize(view.diffs.length, "window", "windows")}</span></div>
      <h3><a href="#${escapeHtml(view.project.slug)}">${escapeHtml(view.project.name)}</a></h3>
      <div class="trail-summaries">${summaries}</div>
      <a class="text-link" href="${escapeHtml(view.project.slug)}-changes.md">Commit trail <span aria-hidden="true">-&gt;</span></a>
    </article>`;
    })
    .join("\n");
  return `<section class="commit-trail" id="commit-trail">
    ${header}
    <div class="trail-grid">${cards}</div>
  </section>`;
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

function siteCss(theme: ThemeTokens): string {
  return `
${themeVariables(theme)}
* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body { margin: 0; min-width: 320px; background: var(--ink); color: var(--text); font-family: var(--font); line-height: 1.5; }
a { color: inherit; }
.site-shell { min-height: 100vh; background: var(--glow), var(--ink); }
.container { width: min(1180px, calc(100% - 48px)); margin: 0 auto; }
.site-nav { display: flex; justify-content: space-between; align-items: center; padding: 28px 0; border-bottom: 1px solid var(--line); }
.nav-links { display: flex; gap: 20px; }
.brand { display: inline-flex; align-items: center; gap: 12px; font: 700 0.9rem/1 "SFMono-Regular", Consolas, monospace; letter-spacing: 0.08em; text-decoration: none; text-transform: uppercase; }
.brand-mark { display: grid; width: 30px; height: 30px; place-items: center; border: 1px solid var(--blue); color: var(--blue); border-radius: 8px; font-size: 0.72rem; }
.nav-link { color: var(--muted); font: 0.76rem/1 "SFMono-Regular", Consolas, monospace; letter-spacing: 0.08em; text-decoration: none; text-transform: uppercase; }
.nav-link:hover, .text-link:hover, h2 a:hover { color: var(--blue); }
.hero { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(300px, 0.7fr); gap: 80px; align-items: end; padding: 86px 0 70px; }
.kicker, .eyebrow, .visual-label, .card-topline, .section-heading, .source-badge, .audit-label { font: 0.7rem/1.4 "SFMono-Regular", Consolas, monospace; letter-spacing: 0.12em; text-transform: uppercase; }
.kicker { color: var(--mint); margin: 0 0 22px; }
h1 { max-width: 760px; margin: 0; font-size: clamp(3.2rem, 8vw, 6.4rem); font-weight: 650; letter-spacing: -0.08em; line-height: 0.94; }
.hero-copy { max-width: 530px; margin: 28px 0 0; color: var(--blue-soft); font-size: 1.12rem; }
.hero-aside { padding: 22px; border: 1px solid var(--line); border-radius: var(--radius); background: var(--aside-gradient); box-shadow: var(--shadow); }
.aside-index { display: flex; justify-content: space-between; color: var(--orange); font: 0.68rem/1 "SFMono-Regular", Consolas, monospace; letter-spacing: 0.12em; text-transform: uppercase; }
.hero-aside p { margin: 24px 0 4px; color: var(--text); font-size: 1rem; }
.stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
.stat { min-height: 104px; padding: 20px 22px; border-right: 1px solid var(--line); }
.stat:last-child { border-right: 0; }
.stat strong { display: block; color: var(--text); font-size: 1.8rem; font-weight: 600; letter-spacing: -0.04em; }
.stat span { color: var(--muted); font: 0.7rem/1.3 "SFMono-Regular", Consolas, monospace; letter-spacing: 0.08em; text-transform: uppercase; }
.audit-panel { display: grid; grid-template-columns: 1fr auto; gap: 20px; align-items: center; margin: 26px 0 80px; padding: 18px 20px; border: 1px solid var(--line); border-radius: var(--radius); background: var(--audit-bg); }
.audit-copy { color: var(--muted); font-size: 0.88rem; }
.audit-copy strong { color: var(--text); font-weight: 500; }
.audit-time { color: var(--blue); font: 0.7rem/1.4 "SFMono-Regular", Consolas, monospace; text-align: right; }
.index-header { display: flex; justify-content: space-between; align-items: end; gap: 24px; margin-bottom: 24px; }
.index-header h2 { margin: 0; font-size: 2rem; font-weight: 550; letter-spacing: -0.05em; }
.index-header p { max-width: 350px; margin: 0; color: var(--muted); font-size: 0.88rem; text-align: right; }
.project-card { display: grid; grid-template-columns: minmax(280px, 0.8fr) minmax(0, 1.2fr); overflow: hidden; margin-bottom: 24px; border: 1px solid var(--line); border-radius: var(--radius); background: var(--panel-gradient); box-shadow: var(--shadow); }
.project-visual { position: relative; min-height: 310px; background: var(--visual); }
.screenshot { display: block; width: 100%; height: 100%; min-height: 310px; object-fit: cover; opacity: 0.9; }
.placeholder { display: flex; min-height: 310px; align-items: center; justify-content: center; flex-direction: column; gap: 7px; color: var(--blue); background: repeating-linear-gradient(135deg, var(--stripe), var(--stripe) 1px, transparent 1px, transparent 14px); }
.placeholder small { color: var(--muted); font: 0.68rem/1 "SFMono-Regular", Consolas, monospace; text-transform: uppercase; }
.visual-label { position: absolute; right: 16px; bottom: 16px; padding: 7px 9px; border: 1px solid var(--label-border); border-radius: 5px; background: var(--label-bg); color: var(--blue-soft); }
.project-body { padding: 30px 34px 32px; }
.card-topline { display: flex; justify-content: space-between; gap: 12px; color: var(--blue); }
.project-body h2 { margin: 18px 0 8px; font-size: 2.1rem; font-weight: 560; letter-spacing: -0.06em; }
.project-body h2 a { text-decoration: none; }
.description { max-width: 620px; margin: 0; color: var(--blue-soft); font-size: 0.98rem; }
.facts { display: flex; flex-wrap: wrap; gap: 22px; margin: 24px 0 16px; color: var(--muted); font: 0.76rem/1 "SFMono-Regular", Consolas, monospace; }
.facts strong { color: var(--text); font-size: 1rem; font-weight: 600; }
.tags { display: flex; flex-wrap: wrap; gap: 7px; margin-bottom: 26px; }
.tag { padding: 5px 9px; border: 1px solid var(--tag-border); border-radius: 999px; color: var(--mint); background: var(--tag-bg); font: 0.68rem/1 "SFMono-Regular", Consolas, monospace; }
.change-log { padding: 18px 0 20px; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
.section-heading { display: flex; justify-content: space-between; color: var(--orange); }
.source-badge { color: var(--muted); }
.change-log h3 { margin: 12px 0 2px; font-size: 1.08rem; font-weight: 550; }
.change-date { margin: 0 0 10px; color: var(--muted); font: 0.7rem/1.3 "SFMono-Regular", Consolas, monospace; }
.change-preview { max-height: 130px; overflow: hidden; color: var(--muted); font-size: 0.83rem; }
.change-preview h3, .change-preview h4 { margin: 12px 0 4px; color: var(--text); font-size: 0.78rem; font-weight: 600; }
.change-preview p { margin: 3px 0; }
.change-preview li { margin: 3px 0 3px 18px; }
.change-preview code { padding: 2px 4px; border-radius: 3px; color: var(--mint); background: var(--code-bg); font: 0.76rem "SFMono-Regular", Consolas, monospace; }
.text-link { display: inline-block; margin-top: 14px; color: var(--blue); font: 0.73rem/1 "SFMono-Regular", Consolas, monospace; text-decoration: none; text-transform: uppercase; }
.card-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 22px; }
.button { display: inline-block; padding: 10px 14px; border-radius: 7px; font: 0.72rem/1 "SFMono-Regular", Consolas, monospace; letter-spacing: 0.04em; text-decoration: none; text-transform: uppercase; }
.button.primary { background: var(--blue); color: var(--button-text); }
.button.primary:hover { background: var(--blue-soft); }
.button.secondary { border: 1px solid var(--line); color: var(--text); }
.button.secondary:hover { border-color: var(--blue); color: var(--blue); }
.muted { color: var(--muted); }
.commit-trail { margin: 80px 0; }
.trail-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 18px; }
.trail-card { padding: 22px 24px; border: 1px solid var(--line); border-radius: var(--radius); background: var(--panel-gradient); box-shadow: var(--shadow); }
.trail-topline { display: flex; justify-content: space-between; gap: 12px; color: var(--blue); font: 0.66rem/1.4 "SFMono-Regular", Consolas, monospace; letter-spacing: 0.1em; text-transform: uppercase; }
.trail-card h3 { margin: 14px 0 12px; font-size: 1.15rem; font-weight: 560; letter-spacing: -0.03em; }
.trail-card h3 a { text-decoration: none; }
.trail-summaries { display: grid; gap: 8px; margin-bottom: 14px; }
.trail-summary { display: flex; justify-content: space-between; gap: 12px; padding: 9px 11px; border: 1px solid var(--line-soft); border-radius: 7px; background: var(--audit-bg); color: var(--muted); font: 0.7rem/1.4 "SFMono-Regular", Consolas, monospace; }
.trail-version { color: var(--mint); }
.source-trail { display: grid; grid-template-columns: 0.8fr 1.2fr; gap: 36px; margin: 80px 0; padding: 26px 0; border-top: 1px solid var(--line); }
.source-trail h2 { margin: 0 0 8px; font-size: 1.2rem; font-weight: 550; }
.source-trail p { margin: 0; color: var(--muted); font-size: 0.86rem; }
.audit-list { margin: 0; padding: 0; list-style: none; }
.audit-list li { display: grid; grid-template-columns: 150px 72px 1fr; gap: 12px; padding: 8px 0; border-bottom: 1px solid var(--line-soft); color: var(--muted); font: 0.72rem/1.4 "SFMono-Regular", Consolas, monospace; }
.audit-list time { color: var(--blue); }
.audit-list strong { color: var(--orange); font-weight: 500; text-transform: uppercase; }
.site-footer { display: flex; justify-content: space-between; gap: 20px; padding: 24px 0 40px; border-top: 1px solid var(--line); color: var(--muted); font: 0.7rem/1.4 "SFMono-Regular", Consolas, monospace; }
.site-footer p { margin: 0; }
@media (max-width: 850px) {
  .hero { grid-template-columns: 1fr; gap: 34px; padding-top: 58px; }
  .stats-grid { grid-template-columns: repeat(2, 1fr); }
  .stat:nth-child(2) { border-right: 0; }
  .stat:nth-child(-n+2) { border-bottom: 1px solid var(--line); }
  .project-card, .source-trail { grid-template-columns: 1fr; }
  .project-visual, .screenshot, .placeholder { min-height: 240px; }
  .index-header { align-items: start; flex-direction: column; }
  .index-header p { text-align: left; }
  .audit-panel { grid-template-columns: 1fr; }
  .audit-time { text-align: left; }
}
@media (max-width: 560px) {
  .container { width: min(100% - 28px, 1180px); }
  .site-nav { padding: 20px 0; }
  h1 { font-size: 3.4rem; }
  .project-body { padding: 24px 20px; }
  .project-body h2 { font-size: 1.8rem; }
  .audit-list li { grid-template-columns: 1fr; gap: 2px; }
  .site-footer { flex-direction: column; }
}
`;
}

export interface SiteManifestProject {
  slug: string;
  name: string;
  url: string;
  changelogFile: string | null;
  changesFile: string | null;
}

export interface SiteManifest {
  formatVersion: 3;
  generatedAt: string;
  title: string;
  owner: string;
  theme: {
    name: string;
    mode: string;
    accent: string;
    radius: string;
    font: string;
  };
  feed: string;
  projectCount: number;
  projects: SiteManifestProject[];
  files: string[];
  screenshots: string[];
}

export interface PublishResult {
  indexPath: string;
  manifestPath: string;
  galleryPath: string;
  feedPath: string;
  projectCount: number;
  generatedAt: string;
  theme: string;
  copiedScreenshots: number;
}

function relativePosixPaths(outputDir: string): string[] {
  const paths: string[] = [];
  const walk = (current: string, prefix: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        walk(join(current, entry.name), relative);
      } else {
        paths.push(relative);
      }
    }
  };
  walk(outputDir, "");
  return paths.sort();
}

export function publishSite(config: PortfolioConfig): PublishResult {
  const db = openDatabase(config.dataDir, config.clock);
  try {
    const projects = db.listProjects(true);
    const generatedAt = config.clock();
    const theme = resolveTheme(config.theme);
    const views = projects.map((project) => {
      const changelog = db.getChangelog(project.id);
      const commits = db.getCommitsAscending(project.id);
      return {
        project,
        changelog,
        evidence: {
          commits: db.countCommits(project.id),
          releases: db.countReleases(project.id),
        },
        diffs: summarizeCommitDiffs(
          commits.map((commit) => ({
            sha: commit.sha,
            message: commit.message,
            committed_at: commit.committed_at,
          })),
          changelog.map((entry) => ({
            version: entry.version,
            title: entry.title,
            published_at: entry.published_at,
          }))
        ),
      };
    });
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

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="description" content="${escapeHtml(config.tagline)}" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; img-src 'self' data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'" />
  <title>${escapeHtml(config.title)} / Portfolio</title>
  <link rel="alternate" type="application/rss+xml" title="${escapeHtml(config.title)} Feed" href="feed.xml" />
  <style>${siteCss(theme)}</style>
</head>
<body>
  <div class="site-shell">
    <div class="container">
      <nav class="site-nav" aria-label="Primary navigation">
        <a class="brand" href="#top"><span class="brand-mark">EP</span><span>${escapeHtml(config.title)}</span></a>
        <div class="nav-links">
          <a class="nav-link" href="#commit-trail">Commit trail -&gt;</a>
          <a class="nav-link" href="#source-trail">Source trail -&gt;</a>
          <a class="nav-link" href="feed.xml">Feed -&gt;</a>
        </div>
      </nav>
      <header class="hero" id="top">
        <div>
          <p class="kicker">Public repository signal / 01</p>
          <h1>Evidence before adjectives.</h1>
          <p class="hero-copy">${escapeHtml(config.tagline)}. Each project stays connected to its repository, commits, releases, and preview.</p>
        </div>
        <aside class="hero-aside">
          <div class="aside-index"><span>Profile / ${escapeHtml(config.owner)}</span><span>Theme / ${escapeHtml(theme.name)}</span></div>
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
      ${commitTrailSection(views)}
      <section class="source-trail" id="source-trail">
        <div><p class="eyebrow">Audit / 04</p><h2>Refresh trail</h2><p>EngineerProfile records each ingest, capture, and publish operation locally.</p></div>
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

    for (const view of views) {
      if (view.diffs.length === 0) continue;
      const markdown = formatCommitDiffMarkdown(view.project.name, view.diffs);
      writeFileSync(join(config.outputDir, `${view.project.slug}-changes.md`), markdown, "utf-8");
    }

    const copiedScreenshots = copyScreenshotsToOutput(config);

    const galleryPath = join(config.outputDir, "theme-gallery.html");
    const galleryEntries = [
      ...builtinGalleryThemes(),
      { label: "configured", theme: config.theme },
    ];
    writeFileSync(galleryPath, renderThemeGallery(galleryEntries), "utf-8");

    const baseUrl = (config.feed.baseUrl ?? `https://github.com/${config.owner}`).replace(/\/+$/, "");
    const feedPath = join(config.outputDir, "feed.xml");
    writeFileSync(
      feedPath,
      renderRssFeed(
        {
          title: config.title,
          link: baseUrl,
          description: config.tagline,
          language: "en",
          lastBuildDate: toRfc2822(generatedAt),
          generator: "engineer-profile/0.6.0",
        },
        views.map((view) => {
          const latest = view.changelog[0];
          const link = safeExternalUrl(view.project.url) ?? baseUrl;
          const descriptionParts: string[] = [];
          if (view.project.description) descriptionParts.push(view.project.description);
          if (latest) {
            descriptionParts.push(`${latest.title} (${latest.version})`);
            descriptionParts.push(plainText(latest.body).slice(0, 400));
          }
          return {
            title: view.project.name,
            link,
            guid: `${link}#${view.project.slug}`,
            description:
              descriptionParts.join(" / ").slice(0, 500) || "No description provided.",
            pubDate: view.project.last_pushed
              ? toRfc2822(view.project.last_pushed)
              : toRfc2822(generatedAt),
            categories: parseTopics(view.project.topics).slice(0, 5),
          };
        })
      ),
      "utf-8"
    );

    const publishedFiles = relativePosixPaths(config.outputDir);
    const manifest: SiteManifest = {
      formatVersion: 3,
      generatedAt,
      title: config.title,
      owner: config.owner,
      theme: {
        name: theme.name,
        mode: theme.mode,
        accent: theme.blue,
        radius: theme.radius,
        font: theme.font,
      },
      feed: "feed.xml",
      projectCount: projects.length,
      projects: views.map((view) => ({
        slug: view.project.slug,
        name: view.project.name,
        url: view.project.url,
        changelogFile: view.changelog.length > 0 ? `${view.project.slug}-changelog.md` : null,
        changesFile: view.diffs.length > 0 ? `${view.project.slug}-changes.md` : null,
      })),
      files: [...new Set([...publishedFiles, "site-manifest.json"])].sort(),
      screenshots: publishedFiles.filter((file) => file.startsWith("assets/screenshots/")),
    };
    const manifestPath = join(config.outputDir, "site-manifest.json");
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf-8");

    db.logIngest("publish", `${projects.length} projects -> ${indexPath}`);
    return {
      indexPath,
      manifestPath,
      galleryPath,
      feedPath,
      projectCount: projects.length,
      generatedAt,
      theme: theme.name,
      copiedScreenshots,
    };
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

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  displayDate,
  escapeHtml,
  markdownToHtml,
  pageShell,
  parseTopics,
  safeExternalUrl,
  type ProjectView,
} from "./rendering.js";
import type { ChangelogEntry, PortfolioConfig, ProjectRecord } from "../types.js";

function entryBlock(entry: ChangelogEntry): string {
  const sourceUrl = safeExternalUrl(entry.source_url);
  const sourceLabel = entry.source === "release" ? "Read the release on GitHub" : "Inspect the source commits";
  const body = markdownToHtml(entry.body);
  return `<article class="entry" id="${escapeHtml(entry.version)}">
    <div class="section-heading"><span>${escapeHtml(entry.version)} / ${entry.source}</span><span class="source-badge">${displayDate(entry.published_at)}</span></div>
    <h3>${escapeHtml(entry.title)}</h3>
    <p class="change-date">${displayDate(entry.published_at)} / ${escapeHtml(entry.source)}</p>
    <div class="entry-body">${body}</div>
    ${sourceUrl ? `<a class="text-link" href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener noreferrer">${sourceLabel} <span aria-hidden="true">-&gt;</span></a>` : ""}
  </article>`;
}

function factsRow(project: ProjectRecord, evidence: ProjectView["evidence"]): string {
  const items = [
    ["stars", project.stars],
    ["forks", project.forks],
    ["commits", evidence.commits],
    ["release notes", evidence.releases],
  ];
  const cells = items
    .map(([label, value]) => `<span><strong>${value}</strong>${label}</span>`)
    .join("");
  return `<div class="evidence-facts" aria-label="Project facts">${cells}</div>`;
}

export function renderEvidencePage(config: PortfolioConfig, view: ProjectView): string {
  const { project, changelog } = view;
  const repositoryUrl = safeExternalUrl(project.url) ?? "#";
  const homepageUrl = safeExternalUrl(project.homepage);
  const topics = parseTopics(project.topics)
    .map((topic) => `<span class="tag">${escapeHtml(topic)}</span>`)
    .join("");
  const entries = changelog.length
    ? changelog.map(entryBlock).join("\n")
    : '<p class="muted">No changelog entries were found for this project.</p>';

  const body = `<div class="site-shell">
  <div class="container">
    <nav class="site-nav" aria-label="Primary navigation">
      <a class="brand" href="../index.html"><span class="brand-mark">EP</span><span>${escapeHtml(config.title)}</span></a>
      <a class="nav-link" href="../index.html">Project index -&gt;</a>
    </nav>
    <header class="evidence-hero" id="top">
      <p class="kicker">Project evidence / ${escapeHtml(project.slug)}</p>
      <h1>${escapeHtml(project.name)}</h1>
      <p class="hero-copy">${escapeHtml(project.description ?? "No description provided by the repository.")}</p>
      ${factsRow(project, view.evidence)}
      ${topics ? `<div class="tags">${topics}</div>` : ""}
      <div class="evidence-actions">
        <a class="button primary" href="${escapeHtml(repositoryUrl)}" target="_blank" rel="noopener noreferrer">View repository</a>
        <a class="button secondary" href="../${escapeHtml(project.slug)}-changelog.md">Download changelog</a>
        ${homepageUrl ? `<a class="button secondary" href="${escapeHtml(homepageUrl)}" target="_blank" rel="noopener noreferrer">Open homepage</a>` : ""}
      </div>
    </header>
    <main class="changelog-full" aria-label="Changelog evidence">
      <div class="index-header"><div><p class="eyebrow">Evidence / changelog</p><h2>Changelog</h2></div><p>Every entry keeps its source link and publish date.</p></div>
      ${entries}
    </main>
    <footer class="site-footer"><p>${escapeHtml(config.title)} / evidence page</p><p>Facts on this page come from stored repository data.</p></footer>
  </div>
</div>`;

  return pageShell(config, `${project.name} / ${config.title}`, body);
}

export function writeEvidencePages(config: PortfolioConfig, views: ProjectView[]): number {
  let written = 0;
  for (const view of views) {
    const pageDir = join(config.outputDir, view.project.slug);
    mkdirSync(pageDir, { recursive: true });
    writeFileSync(join(pageDir, "index.html"), renderEvidencePage(config, view), "utf-8");
    written++;
  }
  return written;
}

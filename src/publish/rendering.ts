import type { ChangelogEntry, PortfolioConfig, ProjectRecord } from "../types.js";

export interface ProjectView {
  project: ProjectRecord;
  changelog: ChangelogEntry[];
  evidence: {
    commits: number;
    releases: number;
  };
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function safeExternalUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? value : null;
  } catch {
    return null;
  }
}

export function inlineMarkdown(text: string): string {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}

export function markdownToHtml(markdown: string): string {
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

export function parseTopics(value: string): string[] {
  try {
    const topics = JSON.parse(value) as unknown;
    return Array.isArray(topics) ? topics.filter((topic): topic is string => typeof topic === "string") : [];
  } catch {
    return [];
  }
}

export function displayDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function pageShell(config: PortfolioConfig, title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="description" content="${escapeHtml(config.tagline)}" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; img-src 'self' data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'" />
  <title>${escapeHtml(title)}</title>
  <style>${siteCss()}</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}

export function siteCss(): string {
  return `
:root {
  color-scheme: dark;
  --ink: #08111f;
  --ink-soft: #0d1a2d;
  --panel: #112139;
  --panel-strong: #172a46;
  --line: rgba(169, 195, 222, 0.18);
  --text: #f3f7fb;
  --muted: #9db0c7;
  --blue: #67b7ff;
  --blue-soft: #b8dcff;
  --mint: #a7f3d0;
  --orange: #ffb86b;
  --shadow: 0 24px 60px rgba(0, 0, 0, 0.24);
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body { margin: 0; min-width: 320px; background: var(--ink); color: var(--text); line-height: 1.5; }
a { color: inherit; }
.site-shell { min-height: 100vh; background: radial-gradient(circle at 82% -10%, rgba(70, 148, 232, 0.2), transparent 34rem), var(--ink); }
.container { width: min(1180px, calc(100% - 48px)); margin: 0 auto; }
.site-nav { display: flex; justify-content: space-between; align-items: center; padding: 28px 0; border-bottom: 1px solid var(--line); }
.brand { display: inline-flex; align-items: center; gap: 12px; font: 700 0.9rem/1 "SFMono-Regular", Consolas, monospace; letter-spacing: 0.08em; text-decoration: none; text-transform: uppercase; }
.brand-mark { display: grid; width: 30px; height: 30px; place-items: center; border: 1px solid var(--blue); color: var(--blue); border-radius: 8px; font-size: 0.72rem; }
.nav-link { color: var(--muted); font: 0.76rem/1 "SFMono-Regular", Consolas, monospace; letter-spacing: 0.08em; text-decoration: none; text-transform: uppercase; }
.nav-link:hover, .text-link:hover, h2 a:hover, .button.secondary:hover { color: var(--blue); }
.hero { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(300px, 0.7fr); gap: 80px; align-items: end; padding: 86px 0 70px; }
.kicker, .eyebrow, .visual-label, .card-topline, .section-heading, .source-badge, .audit-label { font: 0.7rem/1.4 "SFMono-Regular", Consolas, monospace; letter-spacing: 0.12em; text-transform: uppercase; }
.kicker { color: var(--mint); margin: 0 0 22px; }
h1 { max-width: 760px; margin: 0; font-size: clamp(3.2rem, 8vw, 6.4rem); font-weight: 650; letter-spacing: -0.08em; line-height: 0.94; }
.hero-copy { max-width: 530px; margin: 28px 0 0; color: var(--blue-soft); font-size: 1.12rem; }
.hero-aside { padding: 22px; border: 1px solid var(--line); border-radius: 14px; background: linear-gradient(145deg, rgba(23, 42, 70, 0.92), rgba(13, 26, 45, 0.72)); box-shadow: var(--shadow); }
.aside-index { display: flex; justify-content: space-between; color: var(--orange); font: 0.68rem/1 "SFMono-Regular", Consolas, monospace; letter-spacing: 0.12em; text-transform: uppercase; }
.hero-aside p { margin: 24px 0 4px; color: var(--text); font-size: 1rem; }
.stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
.stat { min-height: 104px; padding: 20px 22px; border-right: 1px solid var(--line); }
.stat:last-child { border-right: 0; }
.stat strong { display: block; color: var(--text); font-size: 1.8rem; font-weight: 600; letter-spacing: -0.04em; }
.stat span { color: var(--muted); font: 0.7rem/1.3 "SFMono-Regular", Consolas, monospace; letter-spacing: 0.08em; text-transform: uppercase; }
.audit-panel { display: grid; grid-template-columns: 1fr auto; gap: 20px; align-items: center; margin: 26px 0 80px; padding: 18px 20px; border: 1px solid var(--line); border-radius: 10px; background: rgba(17, 33, 57, 0.66); }
.audit-copy { color: var(--muted); font-size: 0.88rem; }
.audit-copy strong { color: var(--text); font-weight: 500; }
.audit-time { color: var(--blue); font: 0.7rem/1.4 "SFMono-Regular", Consolas, monospace; text-align: right; }
.index-header { display: flex; justify-content: space-between; align-items: end; gap: 24px; margin-bottom: 24px; }
.index-header h2 { margin: 0; font-size: 2rem; font-weight: 550; letter-spacing: -0.05em; }
.index-header p { max-width: 350px; margin: 0; color: var(--muted); font-size: 0.88rem; text-align: right; }
.project-card { display: grid; grid-template-columns: minmax(280px, 0.8fr) minmax(0, 1.2fr); overflow: hidden; margin-bottom: 24px; border: 1px solid var(--line); border-radius: 16px; background: linear-gradient(135deg, rgba(23, 42, 70, 0.98), rgba(13, 26, 45, 0.96)); box-shadow: var(--shadow); }
.project-visual { position: relative; min-height: 310px; background: #0a1525; }
.screenshot { display: block; width: 100%; height: 100%; min-height: 310px; object-fit: cover; opacity: 0.9; }
.placeholder { display: flex; min-height: 310px; align-items: center; justify-content: center; flex-direction: column; gap: 7px; color: var(--blue); background: repeating-linear-gradient(135deg, rgba(103, 183, 255, 0.05), rgba(103, 183, 255, 0.05) 1px, transparent 1px, transparent 14px); }
.placeholder small { color: var(--muted); font: 0.68rem/1 "SFMono-Regular", Consolas, monospace; text-transform: uppercase; }
.visual-label { position: absolute; right: 16px; bottom: 16px; padding: 7px 9px; border: 1px solid rgba(255,255,255,0.18); border-radius: 5px; background: rgba(8, 17, 31, 0.72); color: var(--blue-soft); }
.project-body { padding: 30px 34px 32px; }
.card-topline { display: flex; justify-content: space-between; gap: 12px; color: var(--blue); }
.project-body h2 { margin: 18px 0 8px; font-size: 2.1rem; font-weight: 560; letter-spacing: -0.06em; }
.project-body h2 a { text-decoration: none; }
.description { max-width: 620px; margin: 0; color: var(--blue-soft); font-size: 0.98rem; }
.facts { display: flex; flex-wrap: wrap; gap: 22px; margin: 24px 0 16px; color: var(--muted); font: 0.76rem/1 "SFMono-Regular", Consolas, monospace; }
.facts strong { color: var(--text); font-size: 1rem; font-weight: 600; }
.tags { display: flex; flex-wrap: wrap; gap: 7px; margin-bottom: 26px; }
.tag { padding: 5px 9px; border: 1px solid rgba(167, 243, 208, 0.26); border-radius: 999px; color: var(--mint); font: 0.68rem/1 "SFMono-Regular", Consolas, monospace; }
.change-log { padding: 18px 0 20px; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
.section-heading { display: flex; justify-content: space-between; color: var(--orange); }
.source-badge { color: var(--muted); }
.change-log h3 { margin: 12px 0 2px; font-size: 1.08rem; font-weight: 550; }
.change-date { margin: 0 0 10px; color: var(--muted); font: 0.7rem/1.3 "SFMono-Regular", Consolas, monospace; }
.change-preview { max-height: 130px; overflow: hidden; color: var(--muted); font-size: 0.83rem; }
.change-preview h3, .change-preview h4 { margin: 12px 0 4px; color: var(--text); font-size: 0.78rem; font-weight: 600; }
.change-preview p { margin: 3px 0; }
.change-preview li { margin: 3px 0 3px 18px; }
.change-preview code { padding: 2px 4px; border-radius: 3px; color: var(--mint); background: rgba(167, 243, 208, 0.08); font: 0.76rem "SFMono-Regular", Consolas, monospace; }
.text-link { display: inline-block; margin-top: 14px; color: var(--blue); font: 0.73rem/1 "SFMono-Regular", Consolas, monospace; text-decoration: none; text-transform: uppercase; }
.card-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 22px; }
.button { display: inline-block; padding: 10px 14px; border-radius: 7px; font: 0.72rem/1 "SFMono-Regular", Consolas, monospace; letter-spacing: 0.04em; text-decoration: none; text-transform: uppercase; }
.button.primary { background: var(--blue); color: var(--ink); }
.button.primary:hover { background: var(--blue-soft); }
.button.secondary { border: 1px solid var(--line); color: var(--text); }
.button.secondary:hover { border-color: var(--blue); }
.muted { color: var(--muted); }
.source-trail { display: grid; grid-template-columns: 0.8fr 1.2fr; gap: 36px; margin: 80px 0; padding: 26px 0; border-top: 1px solid var(--line); }
.source-trail h2 { margin: 0 0 8px; font-size: 1.2rem; font-weight: 550; }
.source-trail p { margin: 0; color: var(--muted); font-size: 0.86rem; }
.audit-list { margin: 0; padding: 0; list-style: none; }
.audit-list li { display: grid; grid-template-columns: 150px 72px 1fr; gap: 12px; padding: 8px 0; border-bottom: 1px solid rgba(169, 195, 222, 0.1); color: var(--muted); font: 0.72rem/1.4 "SFMono-Regular", Consolas, monospace; }
.audit-list time { color: var(--blue); }
.audit-list strong { color: var(--orange); font-weight: 500; text-transform: uppercase; }
.site-footer { display: flex; justify-content: space-between; gap: 20px; padding: 24px 0 40px; border-top: 1px solid var(--line); color: var(--muted); font: 0.7rem/1.4 "SFMono-Regular", Consolas, monospace; }
.site-footer p { margin: 0; }
.evidence-hero { max-width: 860px; padding: 56px 0 34px; }
.evidence-hero h1 { font-size: clamp(2.6rem, 6vw, 4.6rem); }
.evidence-hero .hero-copy { max-width: 640px; }
.evidence-facts { display: flex; flex-wrap: wrap; gap: 26px; margin: 26px 0 20px; color: var(--muted); font: 0.76rem/1 "SFMono-Regular", Consolas, monospace; }
.evidence-facts strong { display: block; color: var(--text); font-size: 1.3rem; font-weight: 600; letter-spacing: -0.03em; }
.evidence-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 26px; }
.changelog-full { padding: 10px 0 60px; }
.entry { padding: 24px 0; border-bottom: 1px solid var(--line); }
.entry:last-child { border-bottom: 0; }
.entry h3 { margin: 8px 0 4px; font-size: 1.35rem; font-weight: 560; letter-spacing: -0.04em; }
.entry .change-date { margin-bottom: 14px; }
.entry-body { max-width: 720px; color: var(--blue-soft); font-size: 0.95rem; }
.entry-body h3, .entry-body h4 { margin: 16px 0 6px; color: var(--text); font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.06em; }
.entry-body p { margin: 6px 0; }
.entry-body li { margin: 4px 0 4px 20px; }
.entry-body code { padding: 2px 4px; border-radius: 3px; color: var(--mint); background: rgba(167, 243, 208, 0.08); font: 0.82rem "SFMono-Regular", Consolas, monospace; }
.entry-body strong { color: var(--text); }
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

import type { ThemeConfig } from "../types.js";
import {
  listBuiltinThemes,
  resolveTheme,
  themePropertyDeclarations,
  type ThemeTokens,
} from "./palette.js";

export interface GalleryTheme {
  label: string;
  theme: ThemeConfig;
}

export function builtinGalleryThemes(): GalleryTheme[] {
  return listBuiltinThemes().map((entry) => ({
    label: entry.name,
    theme: { name: entry.name },
  }));
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function styleAttribute(tokens: ThemeTokens): string {
  return themePropertyDeclarations(tokens).replace(/\n\s*/g, " ");
}

function swatchMeta(tokens: ThemeTokens): string {
  return [
    `mode ${tokens.mode}`,
    `accent ${tokens.blue}`,
    `radius ${tokens.radius}`,
    `font ${tokens.font}`,
  ].join(" / ");
}

function themeSwatch(entry: GalleryTheme): string {
  const tokens = resolveTheme(entry.theme);
  return `<section class="swatch">
    <div class="swatch-preview" style="${escapeHtml(styleAttribute(tokens))}">
      <header class="swatch-nav"><span class="mark">EP</span><span class="nav-label">engineer-profile / theme</span></header>
      <p class="kicker">Public repository signal / ${escapeHtml(entry.label)}</p>
      <h2>Evidence before adjectives.</h2>
      <p class="copy">A working sample of the theme. <strong>Bold facts</strong>, <code>inline code</code>, tags, and buttons keep their contrast.</p>
      <div class="swatch-actions"><a class="btn primary">Primary action</a><a class="btn secondary">Secondary</a></div>
      <div class="swatch-tags"><span class="tag">typescript</span><span class="tag">node</span><span class="tag">sqlite</span></div>
    </div>
    <footer class="swatch-meta"><span>${escapeHtml(entry.label)}</span><span>${escapeHtml(swatchMeta(tokens))}</span></footer>
  </section>`;
}

function galleryCss(): string {
  return `
* { box-sizing: border-box; }
:root { color-scheme: dark; }
body { margin: 0; background: #0b0f14; color: #e6edf3; font-family: Inter, ui-sans-serif, system-ui, sans-serif; line-height: 1.5; }
.page { width: min(1180px, calc(100% - 48px)); margin: 0 auto; padding: 48px 0 64px; }
.page-head { display: flex; justify-content: space-between; align-items: end; gap: 24px; margin-bottom: 40px; padding-bottom: 26px; border-bottom: 1px solid #21262d; }
.page-head h1 { margin: 0; font-size: clamp(1.8rem, 4vw, 2.6rem); letter-spacing: -0.04em; }
.page-head p { max-width: 480px; margin: 0; color: #9da7b3; font-size: 0.92rem; text-align: right; }
.swatches { display: grid; grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)); gap: 28px; }
.swatch { overflow: hidden; border: 1px solid #21262d; border-radius: 16px; background: #11151b; }
.swatch-preview { padding: 26px; }
.swatch-nav { display: flex; justify-content: space-between; align-items: center; font: 700 0.72rem/1 ui-monospace, Consolas, monospace; letter-spacing: 0.08em; text-transform: uppercase; }
.mark { display: grid; width: 28px; height: 28px; place-items: center; border: 1px solid var(--blue); color: var(--blue); border-radius: 8px; font-size: 0.66rem; }
.nav-label { color: var(--muted); }
.kicker { margin: 24px 0 10px; color: var(--mint); font: 0.68rem/1.4 ui-monospace, Consolas, monospace; letter-spacing: 0.12em; text-transform: uppercase; }
.swatch-preview h2 { margin: 0; color: var(--text); font-size: 1.6rem; font-weight: 600; letter-spacing: -0.05em; }
.copy { margin: 12px 0 0; color: var(--blue-soft); font-size: 0.92rem; }
.copy code { padding: 2px 5px; border-radius: 4px; color: var(--mint); background: var(--code-bg); font: 0.78rem ui-monospace, Consolas, monospace; }
.swatch-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 20px; }
.btn { padding: 10px 14px; border-radius: 7px; font: 0.72rem/1 ui-monospace, Consolas, monospace; letter-spacing: 0.04em; text-decoration: none; text-transform: uppercase; }
.btn.primary { background: var(--blue); color: var(--button-text); }
.btn.secondary { border: 1px solid var(--line); color: var(--text); }
.swatch-tags { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 20px; }
.tag { padding: 4px 9px; border: 1px solid var(--tag-border); border-radius: 999px; color: var(--mint); background: var(--tag-bg); font: 0.66rem/1 ui-monospace, Consolas, monospace; }
.swatch-meta { display: flex; justify-content: space-between; gap: 12px; padding: 13px 18px; border-top: 1px solid #21262d; background: #0d1117; color: #9da7b3; font: 0.66rem/1.5 ui-monospace, Consolas, monospace; }
.page-foot { margin-top: 44px; color: #9da7b3; font: 0.72rem/1.5 ui-monospace, Consolas, monospace; }
@media (max-width: 560px) {
  .page { width: calc(100% - 28px); }
  .page-head { flex-direction: column; align-items: start; }
  .page-head p { text-align: left; }
  .swatches { grid-template-columns: 1fr; }
  .swatch-meta { flex-direction: column; }
}
`;
}

export function renderThemeGallery(entries: GalleryTheme[]): string {
  const swatches = entries.map(themeSwatch).join("\n");
  const names = entries.map((entry) => entry.label).join(", ");
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="description" content="EngineerProfile built-in theme gallery" />
  <title>EngineerProfile / Theme gallery</title>
  <style>${galleryCss()}</style>
</head>
<body>
  <div class="page">
    <header class="page-head">
      <div><p class="kicker" style="color:#67b7ff;font:0.68rem/1.4 ui-monospace,Consolas,monospace;letter-spacing:0.12em;text-transform:uppercase;margin:0 0 10px;">EngineerProfile / presentation</p><h1>Theme gallery</h1></div>
      <p>Every card renders with its own theme tokens. Compare palettes before you choose a theme.</p>
    </header>
    <main class="swatches">
${swatches}
    </main>
    <footer class="page-foot">Themes in this gallery: ${escapeHtml(names)}. The published site uses one configured theme.</footer>
  </div>
</body>
</html>`;
}

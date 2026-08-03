import type { ThemeDefinition } from "./registry.js";

export const terminal: ThemeDefinition = {
  name: "terminal",
  description: "Monospace interface inspired by a terminal emulator.",
  css: `
:root {
  color-scheme: dark;
  --ink: #0b0e13;
  --ink-soft: #0f141b;
  --panel: #131a23;
  --panel-strong: #1a222d;
  --line: rgba(126, 231, 135, 0.2);
  --text: #d8ffe0;
  --muted: #7f9c88;
  --blue: #7ee787;
  --blue-soft: #a7eeb0;
  --mint: #ffd166;
  --orange: #ffa657;
  --danger: #ff9e64;
  --shadow: 0 24px 60px rgba(0, 0, 0, 0.5);
  --glow: rgba(126, 231, 135, 0.12);
  --visual-bg: #060809;
  --visual-label-bg: rgba(11, 14, 19, 0.8);
  --blue-rgb: 126, 231, 135;
  --mint-rgb: 255, 209, 102;
  --font-sans: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
  --font-mono: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
}
.brand, .nav-link, .kicker, .eyebrow, .visual-label, .card-topline, .section-heading, .source-badge, .facts, .stat span, .change-date, .text-link, .button, .site-footer { letter-spacing: 0.02em; text-transform: none; }
h1 { font-weight: 700; letter-spacing: -0.04em; }
.project-card { border-radius: 0; }
.hero-aside { border-radius: 0; }
.audit-panel { border-radius: 0; }
`,
};

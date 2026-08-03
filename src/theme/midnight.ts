import type { ThemeDefinition } from "./registry.js";

export const midnight: ThemeDefinition = {
  name: "midnight",
  description: "Dark interface with blue and mint accents.",
  css: `
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
  --danger: #ff7b72;
  --shadow: 0 24px 60px rgba(0, 0, 0, 0.24);
  --glow: rgba(70, 148, 232, 0.2);
  --visual-bg: #0a1525;
  --visual-label-bg: rgba(8, 17, 31, 0.72);
  --blue-rgb: 103, 183, 255;
  --mint-rgb: 167, 243, 208;
  --font-sans: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --font-mono: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
}
`,
};

import type { ThemeDefinition } from "./registry.js";

export const paper: ThemeDefinition = {
  name: "paper",
  description: "Light interface with serif type and warm paper tones.",
  css: `
:root {
  color-scheme: light;
  --ink: #f6f3ec;
  --ink-soft: #efeae0;
  --panel: #ffffff;
  --panel-strong: #fbf8f1;
  --line: rgba(31, 40, 55, 0.16);
  --text: #1f2733;
  --muted: #5d6878;
  --blue: #1f4d8f;
  --blue-soft: #3c5a86;
  --mint: #15765a;
  --orange: #a5541c;
  --danger: #b42318;
  --shadow: 0 24px 60px rgba(40, 32, 16, 0.12);
  --glow: rgba(31, 77, 143, 0.14);
  --visual-bg: #e8e2d6;
  --visual-label-bg: rgba(255, 255, 255, 0.78);
  --blue-rgb: 31, 77, 143;
  --mint-rgb: 21, 118, 90;
  --font-sans: "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, "Times New Roman", serif;
  --font-mono: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
}
.visual-label { border-color: rgba(31, 40, 55, 0.22); }
.button.primary { color: #ffffff; }
`,
};

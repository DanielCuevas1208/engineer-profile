export const DEFAULT_THEME = "aurora";

export interface Theme {
  name: string;
  label: string;
  description: string;
  scheme: "dark" | "light";
  variables: Record<string, string>;
}

const SANS =
  'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const MONO = '"SFMono-Regular", Consolas, monospace';

export const THEMES: Record<string, Theme> = {
  aurora: {
    name: "aurora",
    label: "Aurora",
    description: "Dark blue palette with teal and amber accents. This is the default theme.",
    scheme: "dark",
    variables: {
      scheme: "dark",
      bg: "#08111f",
      "panel-tint": "rgba(17, 33, 57, 0.66)",
      "panel-a": "rgba(23, 42, 70, 0.98)",
      "panel-b": "rgba(13, 26, 45, 0.96)",
      line: "rgba(169, 195, 222, 0.18)",
      "line-soft": "rgba(169, 195, 222, 0.1)",
      text: "#f3f7fb",
      muted: "#9db0c7",
      accent: "#67b7ff",
      "accent-soft": "#b8dcff",
      "accent-2": "#a7f3d0",
      "accent-3": "#ffb86b",
      glow: "rgba(70, 148, 232, 0.2)",
      shadow: "0 24px 60px rgba(0, 0, 0, 0.24)",
      "visual-bg": "#0a1525",
      "visual-shade": "rgba(8, 17, 31, 0.72)",
      stripe: "rgba(103, 183, 255, 0.05)",
      "tag-line": "rgba(167, 243, 208, 0.26)",
      "code-bg": "rgba(167, 243, 208, 0.08)",
      sans: SANS,
      mono: MONO,
    },
  },
  terminal: {
    name: "terminal",
    label: "Terminal",
    description: "Monochrome green on black. Built for low-light reading.",
    scheme: "dark",
    variables: {
      scheme: "dark",
      bg: "#050b06",
      "panel-tint": "rgba(16, 34, 21, 0.66)",
      "panel-a": "rgba(14, 28, 18, 0.98)",
      "panel-b": "rgba(6, 14, 9, 0.96)",
      line: "rgba(130, 255, 165, 0.18)",
      "line-soft": "rgba(130, 255, 165, 0.1)",
      text: "#eafff0",
      muted: "#8bb39a",
      accent: "#66ff8c",
      "accent-soft": "#c5ffd4",
      "accent-2": "#66ff8c",
      "accent-3": "#ffe9a8",
      glow: "rgba(102, 255, 140, 0.14)",
      shadow: "0 24px 60px rgba(0, 0, 0, 0.6)",
      "visual-bg": "#021004",
      "visual-shade": "rgba(2, 16, 4, 0.72)",
      stripe: "rgba(102, 255, 140, 0.05)",
      "tag-line": "rgba(130, 255, 165, 0.26)",
      "code-bg": "rgba(130, 255, 165, 0.08)",
      sans: SANS,
      mono: MONO,
    },
  },
  paper: {
    name: "paper",
    label: "Paper",
    description: "Light theme with a paper background and dark ink text.",
    scheme: "light",
    variables: {
      scheme: "light",
      bg: "#f6f8fb",
      "panel-tint": "rgba(255, 255, 255, 0.72)",
      "panel-a": "#ffffff",
      "panel-b": "#e9eef5",
      line: "rgba(20, 40, 70, 0.12)",
      "line-soft": "rgba(20, 40, 70, 0.08)",
      text: "#14243a",
      muted: "#5a6c82",
      accent: "#1d4ed8",
      "accent-soft": "#1e3a8a",
      "accent-2": "#047857",
      "accent-3": "#b45309",
      glow: "rgba(29, 78, 216, 0.1)",
      shadow: "0 24px 60px rgba(20, 32, 46, 0.14)",
      "visual-bg": "#0f1b2e",
      "visual-shade": "rgba(8, 17, 31, 0.72)",
      stripe: "rgba(29, 78, 216, 0.06)",
      "tag-line": "rgba(4, 120, 87, 0.24)",
      "code-bg": "rgba(4, 120, 87, 0.08)",
      sans: SANS,
      mono: MONO,
    },
  },
};

export function isKnownTheme(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(THEMES, name);
}

export function listThemeNames(): string[] {
  return Object.keys(THEMES);
}

export function resolveTheme(name: string): Theme {
  const theme = THEMES[name];
  if (!theme) {
    throw new Error(`Unknown theme "${name}". Available themes: ${listThemeNames().join(", ")}.`);
  }
  return theme;
}

export function cssVariables(theme: Theme): string {
  return Object.entries(theme.variables)
    .map(([key, value]) => `  --${key}: ${value};`)
    .join("\n");
}

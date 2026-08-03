export type ColorScheme = "dark" | "light";

export interface ThemeDefinition {
  name: string;
  label: string;
  description: string;
  colorScheme: ColorScheme;
  css: Record<string, string>;
}

const DEFAULT_CSS: Record<string, string> = {
  "--ink": "#08111f",
  "--ink-soft": "#0d1a2d",
  "--panel": "#112139",
  "--panel-strong": "#172a46",
  "--line": "rgba(169, 195, 222, 0.18)",
  "--text": "#f3f7fb",
  "--muted": "#9db0c7",
  "--blue": "#67b7ff",
  "--blue-soft": "#b8dcff",
  "--mint": "#a7f3d0",
  "--orange": "#ffb86b",
  "--shadow": "0 24px 60px rgba(0, 0, 0, 0.24)",
  "--panel-soft": "rgba(17, 33, 57, 0.66)",
  "--panel-grad-a": "rgba(23, 42, 70, 0.92)",
  "--panel-grad-b": "rgba(13, 26, 45, 0.72)",
  "--card-grad-a": "rgba(23, 42, 70, 0.98)",
  "--card-grad-b": "rgba(13, 26, 45, 0.96)",
  "--visual-bg": "#0a1525",
  "--visual-chip": "rgba(8, 17, 31, 0.72)",
  "--visual-chip-line": "rgba(255, 255, 255, 0.18)",
};

export const THEMES: Record<string, ThemeDefinition> = {
  default: {
    name: "default",
    label: "Night signal",
    description: "A dark theme with blue accents. This is the default presentation.",
    colorScheme: "dark",
    css: {},
  },
  light: {
    name: "light",
    label: "Daylight paper",
    description: "A light theme with dark text on pale panels.",
    colorScheme: "light",
    css: {
      "--ink": "#f4f6fa",
      "--ink-soft": "#e7ecf3",
      "--panel": "#ffffff",
      "--panel-strong": "#eef3fa",
      "--line": "rgba(13, 26, 45, 0.16)",
      "--text": "#0d1a2d",
      "--muted": "#4d5d74",
      "--blue": "#1563c4",
      "--blue-soft": "#1d4f8f",
      "--mint": "#0d7a4f",
      "--orange": "#9a5a00",
      "--shadow": "0 24px 60px rgba(13, 26, 45, 0.16)",
      "--panel-soft": "rgba(255, 255, 255, 0.72)",
      "--panel-grad-a": "rgba(255, 255, 255, 0.96)",
      "--panel-grad-b": "rgba(238, 243, 250, 0.92)",
      "--card-grad-a": "#ffffff",
      "--card-grad-b": "#eef3fa",
      "--visual-bg": "#dde5ef",
      "--visual-chip": "rgba(255, 255, 255, 0.86)",
      "--visual-chip-line": "rgba(13, 26, 45, 0.18)",
    },
  },
};

export function availableThemeNames(): string[] {
  return Object.keys(THEMES);
}

export function isKnownTheme(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(THEMES, name);
}

export function resolveTheme(name?: string): ThemeDefinition {
  if (name === undefined || name === "default") return THEMES.default;
  const theme = THEMES[name];
  if (!theme) {
    throw new Error(
      `Unknown theme "${name}". Available themes: ${availableThemeNames().join(", ")}.`
    );
  }
  return theme;
}

export function themeCss(theme: ThemeDefinition): string {
  const variables = { ...DEFAULT_CSS, ...theme.css };
  const lines = [`  color-scheme: ${theme.colorScheme};`];
  for (const [key, value] of Object.entries(variables)) {
    lines.push(`  ${key}: ${value};`);
  }
  return lines.join("\n");
}

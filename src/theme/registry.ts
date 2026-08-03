export interface ThemeTokens {
  colorScheme: "dark" | "light";
  ink: string;
  inkSoft: string;
  panel: string;
  panelStrong: string;
  line: string;
  text: string;
  muted: string;
  accent: string;
  accentSoft: string;
  accent2: string;
  accent3: string;
  glow: string;
  shadow: string;
  visualBg: string;
}

export interface ThemeDefinition {
  id: string;
  label: string;
  description: string;
  tokens: ThemeTokens;
}

export const THEMES: Record<string, ThemeDefinition> = {
  midnight: {
    id: "midnight",
    label: "Midnight",
    description: "Dark blue interface for a technical profile.",
    tokens: {
      colorScheme: "dark",
      ink: "#08111f",
      inkSoft: "#0d1a2d",
      panel: "#112139",
      panelStrong: "#172a46",
      line: "rgba(169, 195, 222, 0.18)",
      text: "#f3f7fb",
      muted: "#9db0c7",
      accent: "#67b7ff",
      accentSoft: "#b8dcff",
      accent2: "#a7f3d0",
      accent3: "#ffb86b",
      glow: "rgba(70, 148, 232, 0.2)",
      shadow: "0 24px 60px rgba(0, 0, 0, 0.24)",
      visualBg: "#0a1525",
    },
  },
  paper: {
    id: "paper",
    label: "Paper",
    description: "Light editorial layout for a readable profile.",
    tokens: {
      colorScheme: "light",
      ink: "#f6f3ec",
      inkSoft: "#efe9dc",
      panel: "#fffdf7",
      panelStrong: "#f3ecdd",
      line: "rgba(58, 46, 30, 0.18)",
      text: "#241c12",
      muted: "#6f6352",
      accent: "#9a3b2e",
      accentSoft: "#7a2f25",
      accent2: "#2f6b4f",
      accent3: "#a15c17",
      glow: "rgba(154, 59, 46, 0.12)",
      shadow: "0 24px 60px rgba(58, 46, 30, 0.16)",
      visualBg: "#ece2cf",
    },
  },
  terminal: {
    id: "terminal",
    label: "Terminal",
    description: "Monochrome green layout inspired by a terminal.",
    tokens: {
      colorScheme: "dark",
      ink: "#070a07",
      inkSoft: "#0a0f0a",
      panel: "#0d140d",
      panelStrong: "#111b11",
      line: "rgba(120, 220, 120, 0.28)",
      text: "#c8ffc8",
      muted: "#7fb98f",
      accent: "#66ff99",
      accentSoft: "#aaffcc",
      accent2: "#ffd166",
      accent3: "#ff6b6b",
      glow: "rgba(102, 255, 153, 0.12)",
      shadow: "0 24px 60px rgba(0, 0, 0, 0.5)",
      visualBg: "#040604",
    },
  },
};

export const DEFAULT_THEME_ID = "midnight";

export function isValidThemeId(id: string): boolean {
  return Object.prototype.hasOwnProperty.call(THEMES, id);
}

export function themeIds(): string[] {
  return Object.keys(THEMES);
}

export function getTheme(id: string): ThemeDefinition {
  const theme = THEMES[id];
  if (!theme) {
    throw new Error(
      `Unknown theme "${id}". Use one of: ${themeIds().join(", ")}.`
    );
  }
  return theme;
}

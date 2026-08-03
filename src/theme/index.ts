export interface ThemeTokens {
  ink: string;
  inkSoft: string;
  panel: string;
  panelStrong: string;
  panelFrom: string;
  panelTo: string;
  visual: string;
  overlay: string;
  line: string;
  text: string;
  muted: string;
  blue: string;
  blueSoft: string;
  mint: string;
  orange: string;
  shadow: string;
}

export interface SiteTheme {
  name: string;
  label: string;
  colorScheme: "dark" | "light";
  tokens: ThemeTokens;
}

const DARK: SiteTheme = {
  name: "dark",
  label: "Night field",
  colorScheme: "dark",
  tokens: {
    ink: "#08111f",
    inkSoft: "#0d1a2d",
    panel: "#112139",
    panelStrong: "#172a46",
    panelFrom: "#172a46",
    panelTo: "#0d1a2d",
    visual: "#0a1525",
    overlay: "rgba(8, 17, 31, 0.72)",
    line: "rgba(169, 195, 222, 0.18)",
    text: "#f3f7fb",
    muted: "#9db0c7",
    blue: "#67b7ff",
    blueSoft: "#b8dcff",
    mint: "#a7f3d0",
    orange: "#ffb86b",
    shadow: "0 24px 60px rgba(0, 0, 0, 0.24)",
  },
};

const LIGHT: SiteTheme = {
  name: "light",
  label: "Daylight",
  colorScheme: "light",
  tokens: {
    ink: "#f4f7fb",
    inkSoft: "#e9eef5",
    panel: "#ffffff",
    panelStrong: "#fbfdff",
    panelFrom: "#ffffff",
    panelTo: "#e9eef5",
    visual: "#dde6f0",
    overlay: "rgba(255, 255, 255, 0.86)",
    line: "rgba(13, 26, 45, 0.14)",
    text: "#101828",
    muted: "#5b6b80",
    blue: "#1d63d8",
    blueSoft: "#2f6fe4",
    mint: "#0e7a57",
    orange: "#a34e0e",
    shadow: "0 24px 60px rgba(16, 24, 40, 0.12)",
  },
};

const PAPER: SiteTheme = {
  name: "paper",
  label: "Archive paper",
  colorScheme: "light",
  tokens: {
    ink: "#fbfaf6",
    inkSoft: "#f1efe8",
    panel: "#ffffff",
    panelStrong: "#f7f5ef",
    panelFrom: "#ffffff",
    panelTo: "#f1efe8",
    visual: "#eae5da",
    overlay: "rgba(251, 250, 246, 0.9)",
    line: "rgba(35, 31, 26, 0.18)",
    text: "#231f19",
    muted: "#6c6659",
    blue: "#3f5d7d",
    blueSoft: "#4a6b8c",
    mint: "#5f6f3a",
    orange: "#8a5a2b",
    shadow: "0 24px 60px rgba(35, 31, 26, 0.14)",
  },
};

export const THEMES: SiteTheme[] = [DARK, LIGHT, PAPER];

export function resolveTheme(name: string): SiteTheme {
  const theme = THEMES.find((candidate) => candidate.name === name);
  if (!theme) {
    const names = THEMES.map((candidate) => candidate.name).join(", ");
    throw new Error(`Unknown theme "${name}". Available themes: ${names}.`);
  }
  return theme;
}

export function listThemes(): SiteTheme[] {
  return THEMES.map((theme) => ({ ...theme, tokens: { ...theme.tokens } }));
}

export function themeRootCss(theme: SiteTheme): string {
  const t = theme.tokens;
  return `:root {
  color-scheme: ${theme.colorScheme};
  --ink: ${t.ink};
  --ink-soft: ${t.inkSoft};
  --panel: ${t.panel};
  --panel-strong: ${t.panelStrong};
  --panel-from: ${t.panelFrom};
  --panel-to: ${t.panelTo};
  --visual: ${t.visual};
  --overlay: ${t.overlay};
  --line: ${t.line};
  --text: ${t.text};
  --muted: ${t.muted};
  --blue: ${t.blue};
  --blue-soft: ${t.blueSoft};
  --mint: ${t.mint};
  --orange: ${t.orange};
  --shadow: ${t.shadow};
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}`;
}

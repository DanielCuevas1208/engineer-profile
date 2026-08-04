import { DEFAULT_THEME, type ThemeConfig } from "../types.js";

export type ThemeMode = "dark" | "light";

export interface ThemeTokens {
  name: string;
  mode: ThemeMode;
  ink: string;
  inkSoft: string;
  panel: string;
  panelStrong: string;
  line: string;
  lineSoft: string;
  text: string;
  muted: string;
  blue: string;
  blueSoft: string;
  buttonText: string;
  mint: string;
  orange: string;
  shadow: string;
  visual: string;
  glow: string;
  panelGradient: string;
  asideGradient: string;
  labelBg: string;
  labelBorder: string;
  auditBg: string;
  codeBg: string;
  tagBg: string;
  tagBorder: string;
  stripe: string;
  radius: string;
  font: string;
}

interface BuiltinPalette extends Omit<ThemeTokens, "name"> {
  mode: ThemeMode;
}

const SHARED_FONT =
  'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

const BUILTIN_PALETTES: Record<string, BuiltinPalette> = {
  "deep-space": {
    mode: "dark",
    ink: "#08111f",
    inkSoft: "#0d1a2d",
    panel: "#112139",
    panelStrong: "#172a46",
    line: "rgba(169, 195, 222, 0.18)",
    lineSoft: "rgba(169, 195, 222, 0.1)",
    text: "#f3f7fb",
    muted: "#9db0c7",
    blue: "#67b7ff",
    blueSoft: "#b8dcff",
    buttonText: "#08111f",
    mint: "#a7f3d0",
    orange: "#ffb86b",
    shadow: "0 24px 60px rgba(0, 0, 0, 0.24)",
    visual: "#0a1525",
    glow: "radial-gradient(circle at 82% -10%, rgba(70, 148, 232, 0.2), transparent 34rem)",
    panelGradient: "linear-gradient(135deg, rgba(23, 42, 70, 0.98), rgba(13, 26, 45, 0.96))",
    asideGradient: "linear-gradient(145deg, rgba(23, 42, 70, 0.92), rgba(13, 26, 45, 0.72))",
    labelBg: "rgba(8, 17, 31, 0.72)",
    labelBorder: "rgba(255, 255, 255, 0.18)",
    auditBg: "rgba(17, 33, 57, 0.66)",
    codeBg: "rgba(167, 243, 208, 0.08)",
    tagBg: "rgba(167, 243, 208, 0.06)",
    tagBorder: "rgba(167, 243, 208, 0.26)",
    stripe: "rgba(103, 183, 255, 0.05)",
    radius: "16px",
    font: SHARED_FONT,
  },
  paper: {
    mode: "light",
    ink: "#f6f8fb",
    inkSoft: "#eef1f6",
    panel: "#ffffff",
    panelStrong: "#e9eef5",
    line: "rgba(15, 23, 42, 0.14)",
    lineSoft: "rgba(15, 23, 42, 0.08)",
    text: "#0f172a",
    muted: "#5b6b82",
    blue: "#0f6bbd",
    blueSoft: "#1d4ed8",
    buttonText: "#ffffff",
    mint: "#0f766e",
    orange: "#b45309",
    shadow: "0 24px 60px rgba(15, 23, 42, 0.14)",
    visual: "#e3e9f2",
    glow: "radial-gradient(circle at 82% -10%, rgba(15, 107, 189, 0.14), transparent 34rem)",
    panelGradient: "linear-gradient(135deg, #ffffff, #eef2f8)",
    asideGradient: "linear-gradient(145deg, #ffffff, #edf1f6)",
    labelBg: "rgba(255, 255, 255, 0.8)",
    labelBorder: "rgba(15, 23, 42, 0.12)",
    auditBg: "rgba(255, 255, 255, 0.72)",
    codeBg: "rgba(15, 118, 110, 0.08)",
    tagBg: "rgba(15, 118, 110, 0.06)",
    tagBorder: "rgba(15, 118, 110, 0.24)",
    stripe: "rgba(15, 107, 189, 0.08)",
    radius: "16px",
    font: SHARED_FONT,
  },
};

const BUILTIN_DESCRIPTIONS: Record<string, string> = {
  "deep-space": "Dark palette with blue accents. Default.",
  paper: "Light palette with dark text and strong contrast.",
};

export interface ThemeCatalogEntry {
  name: string;
  description: string;
}

export function listBuiltinThemes(): ThemeCatalogEntry[] {
  return Object.keys(BUILTIN_PALETTES).map((name) => ({
    name,
    description: BUILTIN_DESCRIPTIONS[name] ?? "Built-in theme.",
  }));
}

export function isBuiltinTheme(name: string): boolean {
  return name in BUILTIN_PALETTES;
}

const HEX_COLOR_RE = /^#?[0-9a-f]{3}([0-9a-f]{3})?$/i;

export function isValidHexColor(value: string): boolean {
  return HEX_COLOR_RE.test(value.trim());
}

function normalizeHexColor(value: string): string {
  let hex = value.trim().replace(/^#/, "").toLowerCase();
  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((channel) => channel + channel)
      .join("");
  }
  return `#${hex}`;
}

function hexToRgb(hex: string): [number, number, number] | null {
  const normalized = hex.replace(/^#/, "");
  const match = /^[0-9a-f]{6}$/i.exec(normalized);
  if (!match) return null;
  const value = Number.parseInt(normalized, 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function rgbToHex(rgb: [number, number, number]): string {
  return `#${rgb.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

function mixHex(source: string, target: string, amount: number): string {
  const from = hexToRgb(source) ?? [0, 0, 0];
  const to = hexToRgb(target) ?? [255, 255, 255];
  const mixed = from.map((channel, index) =>
    Math.round(channel + (to[index] - channel) * amount)
  ) as [number, number, number];
  return rgbToHex(mixed);
}

function rgbaFromHex(hex: string, alpha: number): string {
  const [red, green, blue] = hexToRgb(hex) ?? [0, 0, 0];
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function glowFromAccent(accent: string, mode: ThemeMode): string {
  const alpha = mode === "dark" ? 0.2 : 0.14;
  return `radial-gradient(circle at 82% -10%, ${rgbaFromHex(accent, alpha)}, transparent 34rem)`;
}

function stripeFromAccent(accent: string, mode: ThemeMode): string {
  const alpha = mode === "dark" ? 0.05 : 0.08;
  return rgbaFromHex(accent, alpha);
}

export function resolveTheme(config?: ThemeConfig): ThemeTokens {
  const requestedName = config?.name ?? DEFAULT_THEME.name;
  const baseName = isBuiltinTheme(requestedName) ? requestedName : DEFAULT_THEME.name;
  const base = BUILTIN_PALETTES[baseName];

  const tokens: ThemeTokens = {
    ...base,
    name: baseName,
  };

  if (config?.accent) {
    tokens.blue = normalizeHexColor(config.accent);
    tokens.blueSoft = mixHex(tokens.blue, base.mode === "dark" ? "#ffffff" : "#000000", 0.5);
    tokens.glow = glowFromAccent(tokens.blue, base.mode);
    tokens.stripe = stripeFromAccent(tokens.blue, base.mode);
  }
  if (config?.radius) tokens.radius = config.radius;
  if (config?.font) tokens.font = config.font;

  return tokens;
}

export function themeVariables(tokens: ThemeTokens): string {
  return `:root {
  color-scheme: ${tokens.mode};
  --ink: ${tokens.ink};
  --ink-soft: ${tokens.inkSoft};
  --panel: ${tokens.panel};
  --panel-strong: ${tokens.panelStrong};
  --line: ${tokens.line};
  --line-soft: ${tokens.lineSoft};
  --text: ${tokens.text};
  --muted: ${tokens.muted};
  --blue: ${tokens.blue};
  --blue-soft: ${tokens.blueSoft};
  --button-text: ${tokens.buttonText};
  --mint: ${tokens.mint};
  --orange: ${tokens.orange};
  --shadow: ${tokens.shadow};
  --visual: ${tokens.visual};
  --glow: ${tokens.glow};
  --panel-gradient: ${tokens.panelGradient};
  --aside-gradient: ${tokens.asideGradient};
  --label-bg: ${tokens.labelBg};
  --label-border: ${tokens.labelBorder};
  --audit-bg: ${tokens.auditBg};
  --code-bg: ${tokens.codeBg};
  --tag-bg: ${tokens.tagBg};
  --tag-border: ${tokens.tagBorder};
  --stripe: ${tokens.stripe};
  --radius: ${tokens.radius};
  --font: ${tokens.font};
}`;
}

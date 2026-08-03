import { readFileSync } from "node:fs";
import { BASE_CSS } from "./base.js";
import { BUILT_IN_THEMES, getTheme } from "./registry.js";
import type { ThemeConfig } from "../types.js";

export interface ResolvedTheme {
  name: string;
  css: string;
}

export const BUILT_IN_THEME_NAMES: readonly string[] = BUILT_IN_THEMES.map(
  (theme) => theme.name
);

export function isBuiltInTheme(name: string): boolean {
  return BUILT_IN_THEME_NAMES.includes(name);
}

function readCustomCss(path: string): string {
  let content: string;
  try {
    content = readFileSync(path, "utf-8");
  } catch (error) {
    throw new Error(`Could not read custom theme CSS "${path}": ${(error as Error).message}`);
  }
  return content.trim();
}

export function resolveThemeCss(theme: ThemeConfig): ResolvedTheme {
  const builtIn = getTheme(theme.name);
  const custom = theme.customCss ? readCustomCss(theme.customCss) : "";

  if (builtIn) {
    return {
      name: theme.name,
      css: `${BASE_CSS}\n${builtIn.css}\n${custom ? `${custom}\n` : ""}`,
    };
  }

  if (!theme.customCss) {
    const known = BUILT_IN_THEME_NAMES.join(", ");
    throw new Error(
      `Unknown theme "${theme.name}". Choose from: ${known}, or provide a custom CSS file.`
    );
  }

  return { name: theme.name, css: `${BASE_CSS}\n${custom}\n` };
}

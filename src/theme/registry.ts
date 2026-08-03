import { midnight } from "./midnight.js";
import { paper } from "./paper.js";
import { terminal } from "./terminal.js";

export interface ThemeDefinition {
  name: string;
  description: string;
  css: string;
}

export const BUILT_IN_THEMES: readonly ThemeDefinition[] = [
  midnight,
  paper,
  terminal,
];

export function getTheme(name: string): ThemeDefinition | undefined {
  return BUILT_IN_THEMES.find((theme) => theme.name === name);
}

export function listThemes(): Array<{ name: string; description: string }> {
  return BUILT_IN_THEMES.map(({ name, description }) => ({ name, description }));
}

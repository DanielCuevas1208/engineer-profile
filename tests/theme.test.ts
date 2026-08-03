import { describe, expect, it } from "vitest";
import { resolveTheme, listThemes, themeRootCss, THEME_KEYS } from "../src/theme/index.js";

describe("site themes", () => {
  it("resolves the default theme by name", () => {
    const theme = resolveTheme("dark");
    expect(theme.name).toBe("dark");
    expect(theme.colorScheme).toBe("dark");
    expect(theme.tokens.ink).toBe("#08111f");
    expect(theme.tokens.text).toBe("#f3f7fb");
  });

  it("exposes distinct light and dark themes", () => {
    const themes = listThemes();
    expect(themes.map((theme) => theme.name)).toEqual(["dark", "light", "paper"]);
    const colorSchemes = new Set(themes.map((theme) => theme.colorScheme));
    expect(colorSchemes.has("dark")).toBe(true);
    expect(colorSchemes.has("light")).toBe(true);
  });

  it("covers every token in the CSS variable output", () => {
    const css = themeRootCss(resolveTheme("light"));
    expect(css).toContain("color-scheme: light");
    for (const key of THEME_KEYS) {
      expect(css).toContain(`--${key}:`);
    }
  });

  it("keeps theme CSS deterministic", () => {
    expect(themeRootCss(resolveTheme("paper"))).toBe(themeRootCss(resolveTheme("paper")));
  });

  it("returns an independent copy of each theme", () => {
    const first = resolveTheme("dark");
    const second = resolveTheme("dark");
    first.tokens.ink = "#000000";
    expect(second.tokens.ink).toBe("#08111f");
  });

  it("rejects unknown theme names", () => {
    expect(() => resolveTheme("mystery")).toThrow(/Unknown theme "mystery"/);
  });
});

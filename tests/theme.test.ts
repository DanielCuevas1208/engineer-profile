import { describe, expect, it } from "vitest";
import { resolveTheme, listThemes, themeRootCss } from "../src/theme/index.js";

describe("site themes", () => {
  it("resolves the default theme by name", () => {
    const theme = resolveTheme("dark");
    expect(theme.name).toBe("dark");
    expect(theme.tokens.ink).toBe("#08111f");
    expect(theme.tokens.text).toBe("#f3f7fb");
  });

  it("exposes at least three distinct themes", () => {
    const themes = listThemes();
    expect(themes.map((theme) => theme.name)).toEqual(["dark", "light", "paper"]);
    const colorSchemes = new Set(themes.map((theme) => theme.colorScheme));
    expect(colorSchemes.size).toBeGreaterThan(1);
  });

  it("renders the full token set into CSS variables", () => {
    const css = themeRootCss(resolveTheme("light"));
    expect(css).toContain("color-scheme: light");
    expect(css).toContain("--ink:");
    expect(css).toContain("--mint:");
    expect(css).toContain("--shadow:");
  });

  it("keeps theme output deterministic", () => {
    expect(themeRootCss(resolveTheme("paper"))).toBe(themeRootCss(resolveTheme("paper")));
  });

  it("rejects unknown theme names", () => {
    expect(() => resolveTheme("mystery")).toThrow(/Unknown theme "mystery"/);
  });
});

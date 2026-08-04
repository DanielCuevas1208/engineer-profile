import { describe, expect, it } from "vitest";
import {
  isBuiltinTheme,
  isValidHexColor,
  listBuiltinThemes,
  resolveTheme,
  themeVariables,
} from "../src/theme/palette.js";
import { DEFAULT_THEME_NAME } from "../src/types.js";

describe("theme catalog", () => {
  it("lists the built-in themes with descriptions", () => {
    const themes = listBuiltinThemes();
    expect(themes.map((theme) => theme.name)).toEqual(["deep-space", "paper"]);
    for (const theme of themes) expect(theme.description.length).toBeGreaterThan(0);
  });

  it("resolves the default theme when no theme is set", () => {
    const tokens = resolveTheme();
    expect(tokens.name).toBe(DEFAULT_THEME_NAME);
    expect(tokens.mode).toBe("dark");
  });

  it("resolves a named built-in theme", () => {
    const tokens = resolveTheme({ name: "paper" });
    expect(tokens.mode).toBe("light");
    expect(tokens.text).toBe("#0f172a");
    expect(tokens.buttonText).toBe("#ffffff");
  });

  it("applies accent, radius, and font overrides", () => {
    const tokens = resolveTheme({
      name: "deep-space",
      accent: "#22c55e",
      radius: "8px",
      font: "Georgia",
    });
    expect(tokens.blue).toBe("#22c55e");
    expect(tokens.radius).toBe("8px");
    expect(tokens.font).toBe("Georgia");
  });

  it("falls back to the default theme for an unknown name", () => {
    expect(isBuiltinTheme("missing")).toBe(false);
    const tokens = resolveTheme({ name: "missing" });
    expect(tokens.name).toBe(DEFAULT_THEME_NAME);
  });

  it("validates hex color values", () => {
    expect(isValidHexColor("#123")).toBe(true);
    expect(isValidHexColor("#123456")).toBe(true);
    expect(isValidHexColor("12ab")).toBe(false);
    expect(isValidHexColor("zzz")).toBe(false);
  });

  it("renders CSS variables for every token", () => {
    const css = themeVariables(resolveTheme());
    expect(css).toContain("color-scheme: dark");
    expect(css).toContain("--ink:");
    expect(css).toContain("--blue:");
    expect(css).toContain("--button-text:");
    expect(css).toContain("--font:");
  });
});

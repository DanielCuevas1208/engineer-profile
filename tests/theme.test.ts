import { describe, it, expect } from "vitest";
import {
  listBuiltinThemes,
  isBuiltinTheme,
  isValidHexColor,
  resolveTheme,
  themeVariables,
} from "../src/theme/palette.js";
import { DEFAULT_THEME } from "../src/types.js";

describe("theme catalog", () => {
  it("exposes deterministic built-in themes", () => {
    const themes = listBuiltinThemes();
    const names = themes.map((theme) => theme.name);
    expect(names).toEqual(["deep-space", "paper", "terminal"]);
    for (const theme of themes) {
      expect(theme.description.length).toBeGreaterThan(0);
    }
  });

  it("recognizes built-in theme names", () => {
    expect(isBuiltinTheme("deep-space")).toBe(true);
    expect(isBuiltinTheme("paper")).toBe(true);
    expect(isBuiltinTheme("terminal")).toBe(true);
    expect(isBuiltinTheme("vaporwave")).toBe(false);
  });
});

describe("hex color validation", () => {
  it("accepts short and long hex forms", () => {
    expect(isValidHexColor("#fff")).toBe(true);
    expect(isValidHexColor("#67b7ff")).toBe(true);
    expect(isValidHexColor("67b7ff")).toBe(true);
  });

  it("rejects non-hex values", () => {
    expect(isValidHexColor("red")).toBe(false);
    expect(isValidHexColor("#12")).toBe(false);
    expect(isValidHexColor("#ggg")).toBe(false);
  });
});

describe("resolveTheme", () => {
  it("defaults to the configured default theme", () => {
    const tokens = resolveTheme();
    expect(tokens.name).toBe(DEFAULT_THEME.name);
    expect(tokens.mode).toBe("dark");
  });

  it("resolves a requested built-in theme", () => {
    const tokens = resolveTheme({ name: "paper" });
    expect(tokens.name).toBe("paper");
    expect(tokens.mode).toBe("light");
  });

  it("falls back to the default theme for unknown names", () => {
    const tokens = resolveTheme({ name: "not-a-theme" });
    expect(tokens.name).toBe(DEFAULT_THEME.name);
  });

  it("applies an accent override to derived tokens", () => {
    const base = resolveTheme({ name: "deep-space" });
    const tokens = resolveTheme({ name: "deep-space", accent: "#ff0000" });
    expect(tokens.blue).toBe("#ff0000");
    expect(tokens.blue).not.toBe(base.blue);
    expect(tokens.glow).toContain("rgba(255, 0, 0,");
    expect(tokens.stripe).toContain("rgba(255, 0, 0,");
  });

  it("applies radius and font overrides", () => {
    const tokens = resolveTheme({ name: "paper", radius: "20px", font: "Georgia, serif" });
    expect(tokens.radius).toBe("20px");
    expect(tokens.font).toBe("Georgia, serif");
  });
});

describe("themeVariables", () => {
  it("emits a :root block with color-scheme and core tokens", () => {
    const tokens = resolveTheme({ name: "deep-space" });
    const css = themeVariables(tokens);
    expect(css).toContain(":root {");
    expect(css).toContain("color-scheme: dark");
    expect(css).toContain("--blue: #67b7ff");
    expect(css).toContain("--font:");
  });

  it("emits deterministic output for the same theme", () => {
    const first = themeVariables(resolveTheme({ name: "paper" }));
    const second = themeVariables(resolveTheme({ name: "paper" }));
    expect(first).toBe(second);
  });
});

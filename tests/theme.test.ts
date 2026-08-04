import { describe, expect, it } from "vitest";
import {
  isValidHexColor,
  listBuiltinThemes,
  resolveTheme,
  themeVariables,
} from "../src/theme/palette.js";

describe("theme resolution", () => {
  it("uses deep-space by default", () => {
    const theme = resolveTheme();
    expect(theme.name).toBe("deep-space");
    expect(theme.mode).toBe("dark");
  });

  it("resolves a named built-in theme", () => {
    const theme = resolveTheme({ name: "paper" });
    expect(theme.name).toBe("paper");
    expect(theme.mode).toBe("light");
    expect(theme.ink).toBe("#f6f8fb");
  });

  it("falls back to the default for an unknown theme name", () => {
    const theme = resolveTheme({ name: "not-a-theme" });
    expect(theme.name).toBe("deep-space");
  });

  it("applies an accent override and derives soft variants", () => {
    const theme = resolveTheme({ name: "deep-space", accent: "#ff0000" });
    expect(theme.blue).toBe("#ff0000");
    expect(theme.blueSoft).toMatch(/^#[0-9a-f]{6}$/);
    expect(theme.glow).toContain("rgba(255, 0, 0,");
    expect(theme.stripe).toContain("rgba(255, 0, 0,");
  });

  it("keeps the base palette when no accent is provided", () => {
    const theme = resolveTheme({ name: "deep-space" });
    expect(theme.blue).toBe("#67b7ff");
    expect(theme.blueSoft).toBe("#b8dcff");
  });

  it("applies radius and font overrides", () => {
    const theme = resolveTheme({
      name: "deep-space",
      radius: "20px",
      font: "Georgia, serif",
    });
    expect(theme.radius).toBe("20px");
    expect(theme.font).toBe("Georgia, serif");
  });
});

describe("theme catalog", () => {
  it("lists every built-in theme with a name", () => {
    const names = listBuiltinThemes().map((theme) => theme.name);
    expect(names).toContain("deep-space");
    expect(names).toContain("paper");
    for (const theme of listBuiltinThemes()) {
      expect(theme.description.length).toBeGreaterThan(0);
    }
  });
});

describe("color validation", () => {
  it("accepts 3-digit and 6-digit hex colors", () => {
    expect(isValidHexColor("#abc")).toBe(true);
    expect(isValidHexColor("#aabbcc")).toBe(true);
    expect(isValidHexColor("aabbcc")).toBe(true);
    expect(isValidHexColor("#67b7ff")).toBe(true);
  });

  it("rejects non-hex values", () => {
    expect(isValidHexColor("red")).toBe(false);
    expect(isValidHexColor("#12")).toBe(false);
    expect(isValidHexColor("#gggfff")).toBe(false);
  });
});

describe("theme variables", () => {
  it("emits a CSS custom property block for light themes", () => {
    const css = themeVariables(resolveTheme({ name: "paper" }));
    expect(css).toContain("color-scheme: light");
    expect(css).toContain("--ink: #f6f8fb");
    expect(css).toContain("--font:");
  });

  it("keeps dark mode and accent tokens", () => {
    const css = themeVariables(resolveTheme({ name: "deep-space", accent: "#0f6bbd" }));
    expect(css).toContain("color-scheme: dark");
    expect(css).toContain("--blue: #0f6bbd");
  });
});

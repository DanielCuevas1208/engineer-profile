import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { resolveThemeCss, isBuiltInTheme, BUILT_IN_THEME_NAMES } from "../src/theme/resolve.js";
import { listThemes } from "../src/theme/registry.js";
import type { ThemeConfig } from "../src/types.js";

const TEST_DIR = join("data", "test-theme");
const CUSTOM_CSS = join(TEST_DIR, "custom.css");

afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }));

describe("theme resolution", () => {
  it("resolves the default theme to the midnight stylesheet", () => {
    const theme: ThemeConfig = { name: "midnight", customCss: null };
    const resolved = resolveThemeCss(theme);

    expect(resolved.name).toBe("midnight");
    expect(resolved.css).toContain(".site-shell");
    expect(resolved.css).toContain("--blue: #67b7ff");
  });

  it("builds a distinct stylesheet for each built-in theme", () => {
    const themes = listThemes();
    expect(themes.map((theme) => theme.name)).toEqual(["midnight", "paper", "terminal"]);

    const stylesheets = new Set(themes.map((theme) => resolveThemeCss({ name: theme.name, customCss: null }).css));
    expect(stylesheets.size).toBe(themes.length);
    expect(BUILT_IN_THEME_NAMES).toEqual(["midnight", "paper", "terminal"]);
  });

  it("marks built-in theme names and rejects unknown ones", () => {
    expect(isBuiltInTheme("paper")).toBe(true);
    expect(isBuiltInTheme("candy")).toBe(false);
  });

  it("throws a clear error for an unknown theme without custom CSS", () => {
    const theme: ThemeConfig = { name: "candy", customCss: null };
    expect(() => resolveThemeCss(theme)).toThrow(/Unknown theme "candy"/);
  });

  it("appends custom CSS after a built-in theme", () => {
    mkdirSync(TEST_DIR, { recursive: true });
    writeFileSync(CUSTOM_CSS, ":root { --blue: #ff0000; }");

    const resolved = resolveThemeCss({ name: "midnight", customCss: CUSTOM_CSS });
    expect(resolved.css.indexOf("--blue: #ff0000")).toBeGreaterThan(
      resolved.css.indexOf("--blue: #67b7ff")
    );
  });

  it("supports a custom theme name backed by a custom CSS file", () => {
    mkdirSync(TEST_DIR, { recursive: true });
    writeFileSync(CUSTOM_CSS, ":root { --ink: #fff; }");

    const resolved = resolveThemeCss({ name: "studio", customCss: CUSTOM_CSS });
    expect(resolved.name).toBe("studio");
    expect(resolved.css).toContain("--ink: #fff");
  });

  it("throws a clear error when the custom CSS file is missing", () => {
    const theme: ThemeConfig = { name: "studio", customCss: join(TEST_DIR, "missing.css") };
    expect(() => resolveThemeCss(theme)).toThrow(/Could not read custom theme CSS/);
  });
});

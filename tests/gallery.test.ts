import { describe, it, expect } from "vitest";
import {
  builtinGalleryThemes,
  renderThemeGallery,
} from "../src/theme/gallery.js";
import {
  listBuiltinThemes,
  resolveTheme,
  themePropertyDeclarations,
  themeVariables,
} from "../src/theme/palette.js";

describe("theme property declarations", () => {
  it("emits color-scheme and every custom property as declarations", () => {
    const tokens = resolveTheme({ name: "deep-space" });
    const declarations = themePropertyDeclarations(tokens);
    expect(declarations).toContain("color-scheme: dark");
    expect(declarations).toContain("--blue: #67b7ff");
    expect(declarations).toContain("--radius: 16px");
    expect(declarations).not.toContain(":root");
  });

  it("wraps the declarations in a :root block through themeVariables", () => {
    const tokens = resolveTheme({ name: "paper" });
    expect(themeVariables(tokens)).toBe(`:root {
  ${themePropertyDeclarations(tokens)}
}`);
  });
});

describe("theme gallery", () => {
  it("lists every built-in theme plus a configured entry", () => {
    const entries = builtinGalleryThemes();
    expect(entries.map((entry) => entry.label)).toEqual(listBuiltinThemes().map((t) => t.name));
  });

  it("renders each built-in theme name in the gallery", () => {
    const html = renderThemeGallery(builtinGalleryThemes());
    for (const entry of builtinGalleryThemes()) {
      expect(html).toContain(entry.label);
    }
    expect(html).toContain("Theme gallery");
  });

  it("scopes theme custom properties to each swatch", () => {
    const html = renderThemeGallery([{ label: "deep-space", theme: { name: "deep-space" } }]);
    expect(html).toContain('<div class="swatch-preview" style="color-scheme: dark; --ink: #08111f;');
    expect(html).toContain("--blue: #67b7ff;");
    expect(html).not.toContain("<style>color-scheme: dark");
  });

  it("reflects an accent override in the rendered swatch", () => {
    const html = renderThemeGallery([{ label: "brand", theme: { name: "deep-space", accent: "#ff6600" } }]);
    expect(html).toContain("--blue: #ff6600;");
  });

  it("produces deterministic output for the same entries", () => {
    const entries = builtinGalleryThemes();
    expect(renderThemeGallery(entries)).toBe(renderThemeGallery(entries));
  });
});

import { readFileSync } from "node:fs";

const OUTPUT = process.env.OUTPUT_DIR ?? "output";

function fail(message) {
  console.error(`Verify failed: ${message}`);
  process.exit(1);
}

function readJson(relativePath) {
  try {
    return JSON.parse(readFileSync(`${OUTPUT}/${relativePath}`, "utf-8"));
  } catch {
    fail(`could not read ${relativePath}`);
  }
}

const manifest = readJson("site-manifest.json");

if (manifest.formatVersion !== 2) {
  fail(`expected formatVersion 2, got ${manifest.formatVersion}`);
}
if (typeof manifest.projectCount !== "number") {
  fail("projectCount is missing");
}
if (manifest.projectCount !== 2) {
  fail(`expected projectCount 2, got ${manifest.projectCount}`);
}
if (typeof manifest.owner !== "string" || manifest.owner === "") {
  fail("owner is missing");
}
if (!Array.isArray(manifest.files) || !manifest.files.includes("index.html")) {
  fail("files does not list index.html");
}
if (!manifest.files.includes("site-manifest.json")) {
  fail("files does not list site-manifest.json");
}
if (!manifest.files.includes("theme-gallery.html")) {
  fail("files does not list theme-gallery.html");
}
if (!Array.isArray(manifest.screenshots)) {
  fail("screenshots is missing");
}

const theme = manifest.theme;
if (typeof theme !== "object" || theme === null) {
  fail("theme is missing");
}
for (const field of ["name", "mode", "accent", "radius", "font"]) {
  if (typeof theme[field] !== "string" || theme[field] === "") {
    fail(`theme.${field} is missing`);
  }
}

let gallery;
try {
  gallery = readFileSync(`${OUTPUT}/theme-gallery.html`, "utf-8");
} catch {
  fail("theme-gallery.html was not generated");
}
for (const name of ["deep-space", "paper", "terminal"]) {
  if (!gallery.includes(name)) {
    fail(`theme gallery does not render ${name}`);
  }
}

console.log(
  `Manifest ok: ${manifest.projectCount} projects, theme ${theme.name} (${theme.mode}), ` +
    `gallery ${manifest.files.includes("theme-gallery.html") ? "present" : "absent"}`
);

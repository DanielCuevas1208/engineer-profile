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

if (manifest.formatVersion !== 3) {
  fail(`expected formatVersion 3, got ${manifest.formatVersion}`);
}
if (typeof manifest.projectCount !== "number") {
  fail("projectCount is missing");
}
if (!Number.isInteger(manifest.projectCount) || manifest.projectCount < 0) {
  fail(`projectCount is invalid: ${manifest.projectCount}`);
}
if (process.env.EXPECTED_PROJECT_COUNT !== undefined &&
    manifest.projectCount !== Number.parseInt(process.env.EXPECTED_PROJECT_COUNT, 10)) {
  fail(`expected projectCount ${process.env.EXPECTED_PROJECT_COUNT}, got ${manifest.projectCount}`);
}
if (typeof manifest.owner !== "string" || manifest.owner === "") {
  fail("owner is missing");
}
if (manifest.feed !== "feed.xml") {
  fail(`expected feed feed.xml, got ${manifest.feed}`);
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
if (!manifest.files.includes("feed.xml")) {
  fail("files does not list feed.xml");
}
if (!Array.isArray(manifest.projects)) {
  fail("projects is missing");
}
for (const project of manifest.projects) {
  if (project.changesFile && !manifest.files.includes(project.changesFile)) {
    fail(`files does not list ${project.changesFile}`);
  }
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

let feed;
try {
  feed = readFileSync(`${OUTPUT}/feed.xml`, "utf-8");
} catch {
  fail("feed.xml was not generated");
}
if (!feed.includes("<rss version=\"2.0\"")) {
  fail("feed.xml is not an RSS 2.0 document");
}
if ((feed.match(/<item>/g) || []).length !== manifest.projectCount) {
  fail(`feed.xml does not contain one item per project (${manifest.projectCount})`);
}

let indexHtml;
try {
  indexHtml = readFileSync(`${OUTPUT}/index.html`, "utf-8");
} catch {
  fail("index.html was not generated");
}
if (!indexHtml.includes("Commit trail")) {
  fail("index.html does not render the commit trail");
}
if (!indexHtml.includes("font-family: var(--font);")) {
  fail("index.html does not apply the theme font token");
}
const projectCardRule = indexHtml.slice(
  indexHtml.indexOf(".project-card"),
  indexHtml.indexOf(".project-card") + 400
);
if (!projectCardRule.includes("border-radius: var(--radius);")) {
  fail("index.html does not apply the theme radius token to project cards");
}
if (!indexHtml.includes("--font:")) {
  fail("index.html does not declare a theme font variable");
}
if (!indexHtml.includes("--radius:")) {
  fail("index.html does not declare a theme radius variable");
}

console.log(
  `Manifest ok: ${manifest.projectCount} projects, theme ${theme.name} (${theme.mode}), ` +
    `gallery ${manifest.files.includes("theme-gallery.html") ? "present" : "absent"}, ` +
    `feed ${manifest.files.includes("feed.xml") ? "present" : "absent"}`
);

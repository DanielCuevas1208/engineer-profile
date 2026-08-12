import { existsSync, readFileSync } from "node:fs";

const DEPLOY_DIR = process.env.DEPLOY_DIR ?? "deploy/public";

function fail(message) {
  console.error(`Verify failed: ${message}`);
  process.exit(1);
}

for (const file of ["index.html", "site-manifest.json", "theme-gallery.html", "feed.xml"]) {
  if (!existsSync(`${DEPLOY_DIR}/${file}`)) {
    fail(`deployed snapshot is missing ${file}`);
  }
}

let manifest;
try {
  manifest = JSON.parse(readFileSync(`${DEPLOY_DIR}/site-manifest.json`, "utf-8"));
} catch {
  fail("deployed site-manifest.json is invalid");
}
if (!Number.isInteger(manifest.projectCount) || manifest.projectCount < 0) {
  fail(`deployed projectCount is invalid: ${manifest.projectCount}`);
}
if (process.env.EXPECTED_PROJECT_COUNT !== undefined &&
    manifest.projectCount !== Number.parseInt(process.env.EXPECTED_PROJECT_COUNT, 10)) {
  fail(`expected deployed projectCount ${process.env.EXPECTED_PROJECT_COUNT}, got ${manifest.projectCount}`);
}

console.log(`Deploy ok: ${DEPLOY_DIR} contains the published snapshot (${manifest.projectCount} projects).`);

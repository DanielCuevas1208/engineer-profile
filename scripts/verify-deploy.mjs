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
if (manifest.projectCount !== 2) {
  fail(`expected deployed projectCount 2, got ${manifest.projectCount}`);
}

console.log(`Deploy ok: ${DEPLOY_DIR} contains the published snapshot (${manifest.projectCount} projects).`);

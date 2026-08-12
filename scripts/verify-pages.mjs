import { verifyPublishedPage } from "../dist/deploy/pages.js";

function fail(message) {
  console.error(`Verify failed: ${message}`);
  process.exit(1);
}

const siteUrl = process.env.SITE_URL;
if (!siteUrl) {
  fail("SITE_URL is required.");
}

try {
  const result = await verifyPublishedPage(siteUrl);
  console.log(`Pages ok: ${result.url} returned ${result.status} (${result.title}).`);
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}

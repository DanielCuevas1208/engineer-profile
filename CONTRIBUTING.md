# Contributing

## Local checks

Use Node.js 20 or newer.

```bash
npm ci
npx playwright install chromium
npm run typecheck
npm run build
npm test
```

Use fixtures for changes that need repeatable data.
Do not add credentials, private repository data, or generated output.
Run `node dist/index.js themes` after theme changes.
Run `node dist/index.js themes --preview` after gallery changes.
Check that `output/index.html` applies the theme font and radius tokens.
Verify `output/site-manifest.json` after publish changes.
Check the deploy sync with `node dist/index.js deploy`.
Run `node dist/index.js deploy --dry-run` before changing a deploy target.
Run `node dist/index.js deploy --dry-run --json` to inspect the report contract.
Run `node scripts/verify-manifest.mjs` and `node scripts/verify-deploy.mjs` after CI-only changes.
Run `node scripts/verify-deploy-report.mjs` after deployment report changes.
Set `SITE_URL` to a reachable HTTPS URL before running `node scripts/verify-pages.mjs`.
Check `.github/workflows/pages.yml` permissions after remote publishing changes.
Verify `output/feed.xml` after changelog or feed changes.
Check `output/*-changes.md` after commit-diff changes.

## Feature areas

The theme catalog lives in `src/theme/`.
Add a palette, then register its description.
The deploy adapters live in `src/deploy/`.
Implement validation, preview diffs, and staging deployments for new providers.
Keep the publish, capture, and deploy stages separated.

## Pull requests

Explain the user value and the data path.
List the checks that you ran.
Keep public claims tied to repository evidence.

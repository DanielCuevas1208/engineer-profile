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
Verify `output/site-manifest.json` after publish changes.
Check the deploy sync with `node dist/index.js deploy`.
Run `node scripts/verify-manifest.mjs` and `node scripts/verify-deploy.mjs` after CI-only changes.

## Pull requests

Explain the user value and the data path.
List the checks that you ran.
Keep public claims tied to repository evidence.
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

## Feature areas

The theme catalog lives in `src/theme/`.
Add a palette, then register its description.
The deploy adapters live in `src/deploy/`.
Keep the publish, capture, and deploy stages separated.

## Pull requests

Explain the user value and the data path.
List the checks that you ran.
Keep public claims tied to repository evidence.
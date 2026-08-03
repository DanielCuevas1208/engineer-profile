# Contributing

## Local checks

Use Node.js 22 or newer.

```bash
npm ci
npx playwright install chromium
npm run typecheck
npm run build
npm test
```

Use fixtures for changes that need repeatable data.
Do not add credentials, private repository data, or generated output.
Keep changes to themes and deployment adapters under `src/theme/` and `src/deploy/`.
Add deterministic tests for new behavior in `tests/`.

## Pull requests

Explain the user value and the data path.
List the checks that you ran.
Keep public claims tied to repository evidence.

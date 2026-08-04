# Contributing

## Local checks

Use Node.js 22 LTS or newer.

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

- Themes: add palettes in `src/theme/palette.ts`.
- Deploy targets: add adapters in `src/deploy/`.
- The publish step writes `site-manifest.json`.
- Keep every behavior deterministic and covered by a test.

## Pull requests

Explain the user value and the data path.
List the checks that you ran.
Keep public claims tied to repository evidence.

# Contributing

## Local checks

Use Node.js 22.12 or newer.

```bash
npm ci
npx playwright install chromium
npm run typecheck
npm run build
npm test
```

Use fixtures for changes that need repeatable data.
Do not add credentials, private repository data, or generated output.

Run the fixture demo to verify the whole pipeline:

```bash
npm run demo
npm run deploy -- --adapter local --target .deploy-check
```

## Pull requests

Explain the user value and the data path.
List the checks that you ran.
Keep public claims tied to repository evidence.
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

For changes to themes, add or update tests in `tests/theme.test.ts`.
For changes to deployment, add or update tests in `tests/deploy.test.ts`.
Verify the deploy path with a temporary target:

```bash
node dist/index.js deploy -d data -o output -t <target-dir>
```

## Pull requests

Explain the user value and the data path.
List the checks that you ran.
Keep public claims tied to repository evidence.
Do not invent users, adoption numbers, or benchmarks.

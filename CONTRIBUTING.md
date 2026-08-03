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

## Pull requests

Explain the user value and the data path.
List the checks that you ran.
Keep public claims tied to repository evidence.

## Release checklist

Bump the version in `package.json`.
Run the demo to confirm the fixture pipeline.
Run all checks from the local checklist.
Update the roadmap in the README.

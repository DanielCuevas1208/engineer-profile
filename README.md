# EngineerProfile

EngineerProfile builds a local engineering portfolio from public repository data.
It stores repository metadata, commits, releases, privacy settings, and preview
paths in SQLite. It publishes a static site from these records.

## Value

- Keep portfolio facts close to their source data.
- Refresh project cards from public GitHub repositories.
- Build release notes from releases or conventional commits.
- Capture repeatable project previews with Playwright.
- Hide projects and redact author emails before publication.
- Select a built-in theme for the published page.
- Stamp deployment metadata for a chosen host.
- Run one configured refresh from a scheduled workflow.

The fixture demo runs without secrets and without network access.

## Architecture

```mermaid
flowchart LR
  C[Checked-in config] --> R[Refresh]
  G[GitHub API] --> I[Ingest]
  F[Fixtures] --> I
  R --> I
  I --> D[(SQLite)]
  D --> L[Changelog]
  D --> P[Privacy]
  D --> S[Playwright]
  L --> W[Publisher]
  P --> W
  S --> W
  T[Theme] --> W
  W --> O[Static output]
  O --> A[Deploy adapter]
```

| Area | Responsibility |
| --- | --- |
| `engineer-profile.config.json` | Store owner, theme, deploy, paths, and privacy settings. |
| `src/config/` | Validate checked-in JSON and merge safe defaults. |
| `src/refresh/` | Coordinate ingest, best-effort capture, static publishing, and deploy. |
| `src/ingest/` | Fetch public GitHub data and map it to records. |
| `src/db/` | Store projects, commits, changelogs, and audit events. |
| `src/changelog/` | Prefer release notes and fall back to commit groups. |
| `src/privacy/` | Hide projects and block sensitive commit messages. |
| `src/preview/` | Capture fixed viewport screenshots with Playwright. |
| `src/theme/` | Resolve named palettes into CSS custom properties. |
| `src/publish/` | Render HTML, changelog files, and preview assets. |
| `src/deploy/` | Write host metadata into the static output. |
| `fixtures/` | Provide deterministic demo data and local preview pages. |

The refresh command runs each stage in a fixed order.
If a preview fails, the command reports the skip and keeps the rest of the snapshot.

## Setup

Use Node.js 22 or newer.

```bash
npm ci
npx playwright install chromium
npm run demo
```

Open `output/index.html` in a browser.

The demo creates a local SQLite database under `data/`.
It writes the static site under `output/`.
Both directories are ignored by Git.

## Configuration

`engineer-profile.config.json` is the checked-in source for scheduled refreshes.
It sets the GitHub owner, site theme, deployment adapter, paths, and privacy controls.

The loader accepts repository limits from 1 through 100.
It rejects malformed values before network access.
The loader rejects unknown theme names and unknown deployment adapters.
CLI `--config`, `--data`, and `--output` options override file values.

Run a network-backed refresh with the checked-in settings:

```bash
npm run refresh
```

The refresh command reads public repositories, captures previews, publishes HTML,
and reports skipped captures.

### Themes

Each theme stores a named palette of CSS custom properties.
The publisher injects the palette into the page.

Built-in themes: `dark`, `light`, and `paper`.

List the themes with `node dist/index.js theme`.
Switch themes by editing the `theme` field, then run `npm run publish`.

### Deployment adapters

An adapter writes host-specific metadata into `output/`.

| Adapter | Metadata |
| --- | --- |
| `gh-pages` | `.nojekyll`, plus `CNAME` when a domain is set. |
| `vercel` | `vercel.json` with clean URLs and screenshot caching. |
| `netlify` | `netlify.toml` with static publishing and screenshot caching. |
| `surge` | `CNAME` with the configured domain. |
| `none` | No metadata files. |

Set the adapter in the `deploy` field.
Set the optional `deploy.domain` field for custom domains.
Adapters write local files. They do not upload anything.
List adapters with `node dist/index.js deploy --list`.
Apply the configured adapter with `node dist/index.js deploy`.

GitHub ingestion uses the public API.
Set `GITHUB_TOKEN` for a higher rate limit.

```powershell
$env:GITHUB_TOKEN="your-token"
npm run refresh
```

Do not put a token in repository files.
Use `.env.example` as a variable reference.

## Sample output

The fixture set contains `signal-router` and `metrics-kit`.
The first project has release notes.
The second project uses commit-based notes.

```text
Ingested 2 fixture projects.
Captured demo-engineer-signal-router.
Captured demo-engineer-metrics-kit.
Published 2 projects to output/index.html.
Copied 2 available preview screenshots.
Prepared deployment for gh-pages (danielcuevas1208.github.io).
Open output/index.html in a browser.
```

The site shows project facts, source links, changelog previews, and screenshots.
The totals come from fixture fields and stored commit records.

## Commands

Build before direct CLI commands.

| Command | Result |
| --- | --- |
| `npm run demo` | Run the complete fixture pipeline. |
| `npm run ingest -- octocat --limit 3` | Load public repository evidence. |
| `npm run ingest -- --fixture` | Load fixture records only. |
| `npm run capture -- --fixture` | Capture local fixture pages. |
| `npm run publish` | Rebuild the site and deployment metadata from SQLite. |
| `npm run refresh` | Run configured ingest, capture, publish, and deploy stages. |
| `node dist/index.js status` | Show visibility and recent operations. |
| `node dist/index.js theme` | List available site themes. |
| `node dist/index.js deploy` | Apply the configured deployment adapter. |
| `node dist/index.js deploy --list` | List available deployment adapters. |
| `npm test` | Run deterministic unit and integration tests. |
| `npm run typecheck` | Validate TypeScript types. |
| `npm run build` | Compile the CLI to `dist/`. |

## Privacy controls

Hide a project before publishing.

```bash
node dist/index.js privacy --hide demo-engineer-metrics-kit
npm run publish
```

Show the project again with `privacy --show`.
Hidden projects remain in SQLite.
Hidden projects stay out of public HTML and copied assets.
Author emails are redacted by default.
Sensitive commit messages are skipped before storage.

## Audit model

Each project stores a repository URL and its last pushed timestamp.
Each stored commit keeps its SHA, message first line, date, and source URL.
Each release keeps its tag, notes, date, and source URL.

The site displays visible projects only.
It links project cards to repositories.
It links release notes to their release pages.
It records local operations in an audit table.

## CI and test status

The regular CI workflow runs typecheck, build, tests, the fixture demo, and artifact upload.
The scheduled refresh workflow runs each Monday and supports manual dispatch.
It uploads the generated site as a workflow artifact.

The test suite covers these core behaviors:

- Configuration validation and default merging.
- Conventional commit parsing.
- Release-first changelog generation.
- SQLite upserts and changelog replacement.
- Privacy filtering and email redaction.
- Fixture ingestion and static publishing.
- Configured refresh orchestration.
- Release source links.
- Deterministic HTML output.
- Theme resolution and token rendering.
- Deployment adapter output files.
- Playwright screenshot capture.

Run the local checks:

```bash
npm run typecheck
npm run build
npm test
```

### Validation status

Typecheck and build pass locally.
CI runs the complete test suite on Ubuntu with Chromium installed.
CI uses Node.js 22 LTS.
The fixture pipeline provides deterministic data for repeatable checks.

## Limitations

- GitHub ingestion needs network access.
- Public API calls have rate limits without a token.
- Capture needs a local Chromium installation.
- Changelog quality depends on releases or conventional commits.
- External pages can fail during capture.
- Capture failures are reported and do not stop publishing.
- Publishing creates local files. It does not deploy them.
- Deployment adapters write local metadata. They do not upload anything.
- Scheduled runs upload artifacts. They do not commit generated output.

## Roadmap

| Release | Status | Scope |
| --- | --- | --- |
| v0.1 | Complete | Fixture demo, GitHub ingest, changelog, capture, publish, and privacy controls. |
| v0.2 | Complete | Checked-in configuration, coordinated refresh command, and scheduled artifact workflow. |
| v0.3 | Complete | Built-in themes and deployment adapters. |
| v0.4 | Next | Commit-diff summaries and an RSS feed. |
| v0.5 | Later | Portfolio search and topic filters. |

## License

MIT. See [LICENSE](LICENSE).

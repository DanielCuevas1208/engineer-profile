# EngineerProfile

EngineerProfile builds a local engineering portfolio from public repository data. It stores repository metadata, commits, releases, privacy settings, previews, and publish records in SQLite. It publishes a static site from these records.

## Value

- Refresh project cards from public GitHub repositories.
- Build release notes from releases or conventional commits.
- Capture repeatable project previews with Playwright.
- Hide projects and redact author emails before publication.
- Choose a presentation theme and override its accent.
- Publish a deployment manifest with each site build.
- Copy the site to a local deploy target.
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
  W --> M[Manifest]
  O --> X[Deploy target]
```

| Area | Responsibility |
| --- | --- |
| `engineer-profile.config.json` | Store owner, presentation, theme, deploy, paths, and privacy settings. |
| `src/config/` | Validate checked-in JSON and merge safe defaults. |
| `src/refresh/` | Coordinate ingest, best-effort capture, and static publishing. |
| `src/ingest/` | Fetch public GitHub data and map it to records. |
| `src/db/` | Store projects, commits, changelogs, and audit events. |
| `src/changelog/` | Prefer release notes and fall back to commit groups. |
| `src/privacy/` | Hide projects and block sensitive commit messages. |
| `src/preview/` | Capture fixed viewport screenshots with Playwright. |
| `src/theme/` | Resolve built-in palettes and theme overrides. |
| `src/publish/` | Render HTML, changelog files, preview assets, and the manifest. |
| `src/deploy/` | Copy the published snapshot to local targets. |
| `fixtures/` | Provide deterministic demo data and local preview pages. |

The refresh command runs each stage in a fixed order. If a preview fails, the command reports the skip and keeps the rest of the snapshot.

## Setup

Use Node.js 22 LTS or newer.

```bash
npm ci
npx playwright install chromium
npm run demo
```

Open `output/index.html` in a browser.

The demo creates a local SQLite database under `data/`. It writes the static site under `output/`. Both directories are ignored by Git.

## Configuration

`engineer-profile.config.json` is the checked-in source for scheduled refreshes. It sets the owner, presentation, theme, deploy targets, repository limit, paths, and privacy controls.

The loader rejects malformed values before network access. CLI `--config`, `--data`, and `--output` options override file values.

Run a network-backed refresh with the checked-in settings:

```bash
npm run refresh
```

The refresh reads public repositories, captures previews, publishes HTML, and reports skipped captures.

GitHub ingestion uses the public API. Set `GITHUB_TOKEN` for a higher rate limit.

```powershell
$env:GITHUB_TOKEN="your-token"
npm run refresh
```

Do not put a token in repository files. Use `.env.example` as a variable reference.

## Themes

The published site uses one built-in theme. Set `theme.name` in the configuration.

| Name | Appearance |
| --- | --- |
| `deep-space` | Dark palette with blue accents. Default. |
| `paper` | Light palette with dark text and strong contrast. |

List built-in themes:

```bash
node dist/index.js themes
```

Override presentation tokens inside the theme:

```json
{
  "theme": {
    "name": "deep-space",
    "accent": "#67b7ff",
    "radius": "16px",
    "font": "Inter, system-ui, sans-serif"
  }
}
```

`accent` must be a hex color. `radius` is a CSS length. `font` is a CSS font stack.

## Deployment

Each publish writes `site-manifest.json`. The manifest lists projects, files, and screenshots. Deployment tooling can read this file.

Add a local deploy target:

```json
{
  "deploy": {
    "targets": [
      { "name": "preview", "type": "local", "target": "public" }
    ]
  }
}
```

Publish and deploy the snapshot:

```bash
node dist/index.js deploy
```

The refresh command also deploys when the configuration defines targets.

## Sample output

The fixture set contains `signal-router` and `metrics-kit`. The first project has release notes. The second project uses commit-based notes.

```text
Ingested 2 fixture projects.
Captured demo-engineer-signal-router.
Captured demo-engineer-metrics-kit.
Published 2 projects to output/index.html.
Copied 2 available preview screenshots.
Open output/index.html in a browser.
```

A deploy with one configured target prints:

```text
Published 2 projects to output/index.html.
Deployed preview: 6 files to public.
```

The site shows project facts, source links, changelog previews, and screenshots. The totals come from fixture fields and stored commit records. The manifest records the same totals in machine-readable form.

## Commands

Build before direct CLI commands.

| Command | Result |
| --- | --- |
| `npm run demo` | Run the complete fixture pipeline. |
| `npm run ingest -- octocat --limit 3` | Load public repository evidence. |
| `npm run ingest -- --fixture` | Load fixture records only. |
| `npm run capture -- --fixture` | Capture local fixture pages. |
| `npm run publish` | Rebuild the site from SQLite. |
| `npm run deploy` | Publish and copy output to deploy targets. |
| `node dist/index.js themes` | List built-in themes. |
| `npm run refresh` | Run configured ingest, capture, publish, and deploy stages. |
| `node dist/index.js status` | Show visibility and recent operations. |
| `npm test` | Run deterministic unit and integration tests. |
| `npm run typecheck` | Validate TypeScript types. |
| `npm run build` | Compile the CLI to `dist/`. |

## Privacy controls

Hide a project before publishing.

```bash
node dist/index.js privacy --hide demo-engineer-metrics-kit
npm run publish
```

Show the project again with `privacy --show`. Hidden projects remain in SQLite. Hidden projects stay out of public HTML and copied assets. Author emails are redacted by default. Sensitive commit messages are skipped before storage.

## Audit model

Each project stores a repository URL and its last pushed timestamp. Each stored commit keeps its SHA, message first line, date, and source URL. Each release keeps its tag, notes, date, and source URL.

The site displays visible projects only. It links project cards to repositories. It links release notes to their release pages. It records local operations in an audit table.

## CI and test status

The regular CI workflow runs typecheck, build, tests, the fixture demo, theme listing, and manifest validation. The scheduled refresh workflow runs each Monday and supports manual dispatch. It uploads the generated site as a workflow artifact.

The test suite covers these core behaviors:

- Configuration validation and default merging.
- Theme resolution and color validation.
- Conventional commit parsing.
- Release-first changelog generation.
- SQLite upserts and changelog replacement.
- Privacy filtering and email redaction.
- Fixture ingestion and static publishing.
- Deployment manifest generation.
- Local deploy target copying.
- Configured refresh orchestration.
- Release source links.
- Deterministic HTML and manifest output.
- Playwright screenshot capture.

Run the local checks:

```bash
npm run typecheck
npm run build
npm test
```

### Validation status

Typecheck and build pass locally. CI runs the complete test suite on Ubuntu with Chromium installed. The fixture pipeline provides deterministic data for repeatable checks.

## Limitations

- GitHub ingestion needs network access.
- Public API calls have rate limits without a token.
- Capture needs a local Chromium installation.
- Changelog quality depends on releases or conventional commits.
- External pages can fail during capture.
- Capture failures are reported and do not stop publishing.
- Two built-in themes ship with the tool.
- Only the local deploy target is available now.
- Publishing creates local files. It does not deploy them.
- Scheduled runs upload artifacts. They do not commit generated output.

## Roadmap

| Release | Status | Scope |
| --- | --- | --- |
| v0.1 | Complete | Fixture demo, GitHub ingest, changelog, capture, publish, and privacy controls. |
| v0.2 | Complete | Checked-in configuration, coordinated refresh command, and scheduled artifact workflow. |
| v0.3 | Complete | Custom themes, deployment manifest, and local deploy target. |
| v0.4 | Next | Remote deploy targets, commit-diff summaries, and an RSS feed. |

## License

MIT. See [LICENSE](LICENSE).

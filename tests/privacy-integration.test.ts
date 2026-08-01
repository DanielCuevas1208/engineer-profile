import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { rmSync } from "node:fs";
import { openDatabase } from "../src/db/client.js";
import { ingestRepository } from "../src/ingest/orchestrator.js";
import { loadFixtureCommits, loadFixtureReleases, loadFixtureRepo } from "../src/fixtures/loader.js";
import { DEFAULT_CONFIG } from "../src/types.js";

const TEST_DATA = "data/test-privacy-integration";

beforeEach(() => rmSync(TEST_DATA, { recursive: true, force: true }));
afterEach(() => rmSync(TEST_DATA, { recursive: true, force: true }));

describe("privacy at ingestion", () => {
  it("keeps sensitive messages out of stored commits and summaries", async () => {
    const config = { ...DEFAULT_CONFIG, dataDir: TEST_DATA };
    const result = await ingestRepository(
      config,
      { owner: "demo-engineer", repo: "metrics-kit" },
      {
        repo: loadFixtureRepo("metrics-kit"),
        commits: [
          ...loadFixtureCommits("metrics-kit"),
          {
            sha: "sensitive123",
            commit: {
              message: "fix: rotate access_token before release",
              author: { name: "Demo Engineer", email: "engineer@example.com", date: "2026-07-21T00:00:00Z" },
            },
            html_url: "https://github.com/demo-engineer/metrics-kit/commit/sensitive123",
          },
        ],
        releases: loadFixtureReleases("metrics-kit"),
      }
    );

    const db = openDatabase(TEST_DATA);
    const project = db.getProjectBySlug(result.slug)!;
    const commits = db.getCommits(project.id);
    const changelog = db.getChangelog(project.id);
    expect(commits.every((commit) => !commit.message.includes("access_token"))).toBe(true);
    expect(changelog[0].body).not.toContain("access_token");
    db.close();
  });
});
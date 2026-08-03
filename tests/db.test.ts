import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { openDatabase } from "../src/db/client.js";

const TEST_DATA = join("data", "test-db");

describe("PortfolioDatabase", () => {
  beforeEach(() => {
    rmSync(TEST_DATA, { recursive: true, force: true });
  });

  afterEach(() => {
    rmSync(TEST_DATA, { recursive: true, force: true });
  });

  it("upserts projects without duplicating slugs", () => {
    const db = openDatabase(TEST_DATA);
    const base = {
      slug: "owner-repo",
      name: "Repo",
      description: "First",
      url: "https://github.com/o/r",
      homepage: null,
      language: "TypeScript",
      stars: 1,
      forks: 0,
      topics: "[]",
      last_pushed: "2026-01-01T00:00:00Z",
      visible: 1,
      screenshot_path: null,
      ingested_at: "2026-01-01T00:00:00Z",
    };
    const first = db.upsertProject(base);
    const second = db.upsertProject({ ...base, description: "Updated", stars: 5 });
    expect(second.id).toBe(first.id);
    expect(second.description).toBe("Updated");
    expect(second.stars).toBe(5);
    db.close();
  });

  it("replaces changelog entries per project", () => {
    const db = openDatabase(TEST_DATA);
    const project = db.upsertProject({
      slug: "p",
      name: "P",
      description: null,
      url: "https://github.com/o/p",
      homepage: null,
      language: null,
      stars: 0,
      forks: 0,
      topics: "[]",
      last_pushed: "2026-01-01T00:00:00Z",
      visible: 1,
      screenshot_path: null,
      ingested_at: "2026-01-01T00:00:00Z",
    });

    db.replaceChangelog(project.id, [
      {
        version: "v1",
        title: "First",
        body: "A",
        source: "release",
        published_at: "2026-01-01T00:00:00Z",
        commit_shas: "[]",
      },
    ]);
    db.replaceChangelog(project.id, [
      {
        version: "v2",
        title: "Second",
        body: "B",
        source: "release",
        published_at: "2026-02-01T00:00:00Z",
        commit_shas: "[]",
      },
    ]);

    const entries = db.getChangelog(project.id);
    expect(entries).toHaveLength(1);
    expect(entries[0].version).toBe("v2");
    db.close();
  });

  it("logs ingest actions for audit trail", () => {
    const db = openDatabase(TEST_DATA);
    db.logIngest("test", "detail line");
    const log = db.getIngestLog(1);
    expect(log).toHaveLength(1);
    expect(log[0].action).toBe("test");
    expect(log[0].detail).toBe("detail line");
    db.close();
  });

  it("aggregates commit diff totals per project", () => {
    const db = openDatabase(TEST_DATA);
    const project = db.upsertProject({
      slug: "diff",
      name: "Diff",
      description: null,
      url: "https://github.com/o/diff",
      homepage: null,
      language: null,
      stars: 0,
      forks: 0,
      topics: "[]",
      last_pushed: "2026-01-01T00:00:00Z",
      visible: 1,
      screenshot_path: null,
      ingested_at: "2026-01-01T00:00:00Z",
    });

    db.upsertCommits(project.id, [
      {
        sha: "one",
        message: "feat: a",
        author_name: "Dev",
        author_email: null,
        committed_at: "2026-01-02T00:00:00Z",
        url: "https://github.com/o/diff/commit/one",
        additions: 84,
        deletions: 12,
        changes: 96,
        files_changed: 3,
      },
      {
        sha: "two",
        message: "fix: b",
        author_name: "Dev",
        author_email: null,
        committed_at: "2026-01-01T00:00:00Z",
        url: "https://github.com/o/diff/commit/two",
        additions: 5,
        deletions: 9,
        changes: 14,
        files_changed: 1,
      },
    ]);

    const summary = db.getDiffSummary(project.id);
    expect(summary).toEqual({ commits: 2, additions: 89, deletions: 21, changes: 110, files: 4 });
    db.close();
  });

  it("returns zero totals when no commits exist", () => {
    const db = openDatabase(TEST_DATA);
    const project = db.upsertProject({
      slug: "empty",
      name: "Empty",
      description: null,
      url: "https://github.com/o/empty",
      homepage: null,
      language: null,
      stars: 0,
      forks: 0,
      topics: "[]",
      last_pushed: "2026-01-01T00:00:00Z",
      visible: 1,
      screenshot_path: null,
      ingested_at: "2026-01-01T00:00:00Z",
    });

    expect(db.getDiffSummary(project.id)).toEqual({
      commits: 0,
      additions: 0,
      deletions: 0,
      changes: 0,
      files: 0,
    });
    db.close();
  });

  it("filters visible projects only", () => {
    const db = openDatabase(TEST_DATA);
    const visible = {
      slug: "visible",
      name: "Visible",
      description: null,
      url: "https://github.com/o/v",
      homepage: null,
      language: null,
      stars: 0,
      forks: 0,
      topics: "[]",
      last_pushed: "2026-01-02T00:00:00Z",
      visible: 1,
      screenshot_path: null,
      ingested_at: "2026-01-01T00:00:00Z",
    };
    const hidden = { ...visible, slug: "hidden", name: "Hidden", visible: 0, last_pushed: "2026-01-03T00:00:00Z" };
    db.upsertProject(visible);
    db.upsertProject(hidden);

    const all = db.listProjects(false);
    const pub = db.listProjects(true);
    expect(all).toHaveLength(2);
    expect(pub).toHaveLength(1);
    expect(pub[0].slug).toBe("visible");
    db.close();
  });
});

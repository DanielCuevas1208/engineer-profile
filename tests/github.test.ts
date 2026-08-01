import { describe, it, expect } from "vitest";
import {
  slugFromFullName,
  repoToProjectRecord,
  commitsToRows,
} from "../src/ingest/github.js";
import type { GitHubCommit, GitHubRepo } from "../src/types.js";
import { DEFAULT_PRIVACY } from "../src/types.js";

const sampleRepo: GitHubRepo = {
  id: 1,
  name: "test-repo",
  full_name: "owner/test-repo",
  description: "A test repository",
  html_url: "https://github.com/owner/test-repo",
  homepage: "https://example.com",
  language: "TypeScript",
  stargazers_count: 10,
  forks_count: 2,
  pushed_at: "2026-01-01T00:00:00Z",
  topics: ["test", "demo"],
  default_branch: "main",
  private: false,
};

describe("slugFromFullName", () => {
  it("converts owner/repo to slug", () => {
    expect(slugFromFullName("demo-engineer/signal-router")).toBe(
      "demo-engineer-signal-router"
    );
  });
});

describe("repoToProjectRecord", () => {
  it("maps repo fields correctly", () => {
    const record = repoToProjectRecord(sampleRepo, DEFAULT_PRIVACY);
    expect(record.slug).toBe("owner-test-repo");
    expect(record.name).toBe("test-repo");
    expect(record.stars).toBe(10);
    expect(record.visible).toBe(1);
    expect(JSON.parse(record.topics)).toEqual(["test", "demo"]);
  });

  it("hides projects in privacy config", () => {
    const record = repoToProjectRecord(sampleRepo, {
      ...DEFAULT_PRIVACY,
      hiddenProjects: ["owner-test-repo"],
    });
    expect(record.visible).toBe(0);
  });

  it("hides private repos", () => {
    const record = repoToProjectRecord({ ...sampleRepo, private: true }, DEFAULT_PRIVACY);
    expect(record.visible).toBe(0);
  });
});

describe("commitsToRows", () => {
  const commits: GitHubCommit[] = [
    {
      sha: "abc123",
      commit: {
        message: "feat: add feature\n\nDetails here",
        author: { name: "Dev", email: "secret@corp.com", date: "2026-01-01T00:00:00Z" },
      },
      html_url: "https://github.com/o/r/commit/abc123",
    },
  ];

  it("uses first line of commit message", () => {
    const rows = commitsToRows(commits, DEFAULT_PRIVACY);
    expect(rows[0].message).toBe("feat: add feature");
  });

  it("redacts emails when configured", () => {
    const rows = commitsToRows(commits, { ...DEFAULT_PRIVACY, redactEmails: true });
    expect(rows[0].author_email).toBeNull();
  });

  it("preserves emails when redaction disabled", () => {
    const rows = commitsToRows(commits, { ...DEFAULT_PRIVACY, redactEmails: false });
    expect(rows[0].author_email).toBe("secret@corp.com");
  });

  it("respects maxCommitsPerProject limit", () => {
    const many = Array.from({ length: 10 }, (_, i) => ({
      ...commits[0],
      sha: `sha${i}`,
    }));
    const rows = commitsToRows(many, { ...DEFAULT_PRIVACY, maxCommitsPerProject: 3 });
    expect(rows).toHaveLength(3);
  });

  it("drops commits with sensitive message patterns", () => {
    const sensitive: GitHubCommit[] = [
      ...commits,
      {
        sha: "secret1",
        commit: {
          message: "fix: rotate api_key in config",
          author: { name: "Dev", email: "dev@test.com", date: "2026-01-02T00:00:00Z" },
        },
        html_url: "https://github.com/o/r/commit/secret1",
      },
    ];
    const rows = commitsToRows(sensitive, DEFAULT_PRIVACY);
    expect(rows).toHaveLength(1);
    expect(rows[0].sha).toBe("abc123");
  });
});

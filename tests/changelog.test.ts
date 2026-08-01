import { describe, it, expect } from "vitest";
import {
  parseConventionalCommit,
  changelogFromReleases,
  changelogFromCommits,
  buildChangelog,
  formatChangelogMarkdown,
} from "../src/changelog/generator.js";
import type { GitHubCommit, GitHubRelease } from "../src/types.js";

const sampleCommits: GitHubCommit[] = [
  {
    sha: "abc123def456",
    commit: {
      message: "feat(api): add health endpoint",
      author: { name: "Dev", email: "dev@test.com", date: "2026-01-15T10:00:00Z" },
    },
    html_url: "https://github.com/o/r/commit/abc123",
  },
  {
    sha: "def456abc789",
    commit: {
      message: "fix(db): close connection on shutdown",
      author: { name: "Dev", email: "dev@test.com", date: "2026-01-14T10:00:00Z" },
    },
    html_url: "https://github.com/o/r/commit/def456",
  },
];

describe("parseConventionalCommit", () => {
  it("parses feat with scope", () => {
    const result = parseConventionalCommit("abc", "feat(auth): add login");
    expect(result).toEqual({
      sha: "abc",
      type: "feat",
      scope: "auth",
      description: "add login",
      breaking: false,
      raw: "feat(auth): add login",
    });
  });

  it("detects breaking changes", () => {
    const result = parseConventionalCommit("abc", "feat!: remove legacy API");
    expect(result?.breaking).toBe(true);
  });

  it("returns null for non-conventional messages", () => {
    expect(parseConventionalCommit("abc", "updated stuff")).toBeNull();
  });
});

describe("changelogFromReleases", () => {
  it("maps releases to changelog sections", () => {
    const releases: GitHubRelease[] = [
      {
        id: 1,
        tag_name: "v1.0.0",
        name: "First release",
        body: "Initial release notes",
        published_at: "2026-01-01T00:00:00Z",
        html_url: "https://github.com/o/r/releases/v1.0.0",
      },
    ];
    const sections = changelogFromReleases(releases);
    expect(sections).toHaveLength(1);
    expect(sections[0].version).toBe("v1.0.0");
    expect(sections[0].source).toBe("release");
    expect(sections[0].body).toBe("Initial release notes");
  });
});

describe("changelogFromCommits", () => {
  it("groups conventional commits by type", () => {
    const section = changelogFromCommits(sampleCommits);
    expect(section).not.toBeNull();
    expect(section!.body).toContain("### Feat");
    expect(section!.body).toContain("### Fix");
    expect(section!.commit_shas).toHaveLength(2);
  });

  it("returns null for empty commits", () => {
    expect(changelogFromCommits([])).toBeNull();
  });
});

describe("buildChangelog", () => {
  it("prefers releases over commits", () => {
    const releases: GitHubRelease[] = [
      {
        id: 1,
        tag_name: "v1.0.0",
        name: "Release",
        body: "Notes",
        published_at: "2026-01-01T00:00:00Z",
        html_url: "https://example.com",
      },
    ];
    const result = buildChangelog(releases, sampleCommits);
    expect(result).toHaveLength(1);
    expect(result[0].source).toBe("release");
  });

  it("falls back to commits when no releases", () => {
    const result = buildChangelog([], sampleCommits);
    expect(result).toHaveLength(1);
    expect(result[0].source).toBe("commits");
  });
});

describe("formatChangelogMarkdown", () => {
  it("produces valid markdown header", () => {
    const md = formatChangelogMarkdown([
      {
        version: "v1.0.0",
        title: "Release",
        body: "Changes here",
        source: "release",
        published_at: "2026-01-01T00:00:00Z",
        commit_shas: [],
      },
    ]);
    expect(md).toContain("# Changelog");
    expect(md).toContain("## Release (v1.0.0)");
  });

  it("handles empty sections", () => {
    const md = formatChangelogMarkdown([]);
    expect(md).toContain("No published changes yet");
  });
});

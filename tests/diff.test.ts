import { describe, expect, it } from "vitest";
import {
  describeDiffCounts,
  formatCommitDiffMarkdown,
  summarizeCommitDiffs,
  UNRELEASED_VERSION,
  type CommitDiffSummary,
} from "../src/changelog/diff.js";

function commit(sha: string, message: string, committed_at: string) {
  return { sha, message, committed_at };
}

describe("summarizeCommitDiffs", () => {
  const commits = [
    commit("aaa", "feat(router): add priority queues", "2026-07-15T10:00:00Z"),
    commit("bbb", "fix(buffer): drop oldest entry", "2026-07-10T10:00:00Z"),
    commit("ccc", "docs: add topology diagram", "2026-07-05T10:00:00Z"),
    commit("ddd", "chore(ci): add typecheck", "2026-06-28T10:00:00Z"),
    commit("eee", "unclassified change", "2026-06-10T10:00:00Z"),
  ];

  const versions = [
    { version: "v0.2.0", title: "Typed channels", published_at: "2026-06-01T08:00:00Z" },
    { version: "v0.3.0", title: "Priority queues", published_at: "2026-07-14T10:00:00Z" },
  ];

  it("buckets commits into version windows", () => {
    const summaries = summarizeCommitDiffs(commits, versions);
    const byVersion = new Map(summaries.map((summary) => [summary.version, summary]));

    expect(byVersion.get("v0.2.0")).toBeUndefined();

    const v030 = byVersion.get("v0.3.0");
    expect(v030).toBeDefined();
    expect(v030!.commits.map((item) => item.sha)).toEqual(["bbb", "ccc", "ddd", "eee"]);
    expect(v030!.counts).toMatchObject({ fix: 1, docs: 1, chore: 1, other: 1 });

    const unreleased = byVersion.get(UNRELEASED_VERSION);
    expect(unreleased).toBeDefined();
    expect(unreleased!.commits.map((item) => item.sha)).toEqual(["aaa"]);
    expect(unreleased!.counts).toMatchObject({ feat: 1 });
  });

  it("returns summaries newest first", () => {
    const summaries = summarizeCommitDiffs(commits, versions);
    expect(summaries[0].version).toBe(UNRELEASED_VERSION);
    expect(summaries[1].version).toBe("v0.3.0");
  });

  it("counts non-conventional commits as other", () => {
    const summaries = summarizeCommitDiffs(
      [
        commit("aaa", "feat: add thing", "2026-07-15T10:00:00Z"),
        commit("bbb", "wip on dashboard", "2026-07-16T10:00:00Z"),
      ],
      []
    );
    expect(summaries).toHaveLength(1);
    expect(summaries[0].counts).toMatchObject({ feat: 1, other: 1 });
  });

  it("returns an empty list for no commits", () => {
    expect(summarizeCommitDiffs([], versions)).toEqual([]);
  });

  it("sorts commits before the oldest version into that version window", () => {
    const summaries = summarizeCommitDiffs(
      [commit("aaa", "feat: initial", "2026-05-01T10:00:00Z")],
      versions
    );
    expect(summaries[0].version).toBe("v0.2.0");
    expect(summaries[0].counts).toMatchObject({ feat: 1 });
  });
});

describe("describeDiffCounts", () => {
  it("lists non-zero types in order", () => {
    const counts = { feat: 2, fix: 1, perf: 0, refactor: 0, docs: 0, test: 0, chore: 0, build: 0, ci: 0, other: 0 };
    expect(describeDiffCounts(counts)).toBe("2 features, 1 fix");
  });

  it("falls back when every type is zero", () => {
    const counts = { feat: 0, fix: 0, perf: 0, refactor: 0, docs: 0, test: 0, chore: 0, build: 0, ci: 0, other: 0 };
    expect(describeDiffCounts(counts)).toBe("no typed changes");
  });
});

describe("formatCommitDiffMarkdown", () => {
  const summaries: CommitDiffSummary[] = [
    {
      version: UNRELEASED_VERSION,
      title: "Unreleased",
      publishedAt: "2026-07-15T10:00:00Z",
      commits: [commit("aabbcc", "feat: add thing", "2026-07-15T10:00:00Z")],
      counts: { feat: 1, fix: 0, perf: 0, refactor: 0, docs: 0, test: 0, chore: 0, build: 0, ci: 0, other: 0 },
    },
  ];

  it("writes a deterministic markdown document", () => {
    const markdown = formatCommitDiffMarkdown("signal-router", summaries);
    expect(markdown).toContain("# signal-router / Commit trail");
    expect(markdown).toContain("## Unreleased");
    expect(markdown).toContain("Commits: 1. 1 feature.");
    expect(markdown).toContain("- feat: add thing (`aabbcc`)");
    expect(markdown).toBe(formatCommitDiffMarkdown("signal-router", summaries));
  });

  it("handles an empty summary list", () => {
    expect(formatCommitDiffMarkdown("signal-router", [])).toContain(
      "No commit activity is recorded."
    );
  });
});

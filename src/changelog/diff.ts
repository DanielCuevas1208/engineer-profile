import { parseConventionalCommit } from "./generator.js";

export interface DiffCommit {
  sha: string;
  message: string;
  committed_at: string;
}

export interface DiffVersion {
  version: string;
  title: string;
  published_at: string;
}

export const DIFF_TYPE_ORDER = [
  "feat",
  "fix",
  "perf",
  "refactor",
  "docs",
  "test",
  "chore",
  "build",
  "ci",
] as const;

export type DiffTypeName = (typeof DIFF_TYPE_ORDER)[number];

export interface DiffCounts {
  feat: number;
  fix: number;
  perf: number;
  refactor: number;
  docs: number;
  test: number;
  chore: number;
  build: number;
  ci: number;
  other: number;
}

export const UNRELEASED_VERSION = "unreleased";
export const UNRELEASED_TITLE = "Unreleased";

export interface CommitDiffSummary {
  version: string;
  title: string;
  publishedAt: string;
  commits: DiffCommit[];
  counts: DiffCounts;
}

export function emptyDiffCounts(): DiffCounts {
  return {
    feat: 0,
    fix: 0,
    perf: 0,
    refactor: 0,
    docs: 0,
    test: 0,
    chore: 0,
    build: 0,
    ci: 0,
    other: 0,
  };
}

function countsFor(commits: DiffCommit[]): DiffCounts {
  const counts = emptyDiffCounts();
  for (const commit of commits) {
    const parsed = parseConventionalCommit(commit.sha, commit.message);
    if (parsed && (DIFF_TYPE_ORDER as readonly string[]).includes(parsed.type)) {
      counts[parsed.type as DiffTypeName]++;
    } else {
      counts.other++;
    }
  }
  return counts;
}

export function summarizeCommitDiffs(
  commits: DiffCommit[],
  versions: DiffVersion[]
): CommitDiffSummary[] {
  const orderedCommits = [...commits].sort(
    (a, b) =>
      a.committed_at.localeCompare(b.committed_at) || a.sha.localeCompare(b.sha)
  );
  const orderedVersions = [...versions].sort(
    (a, b) =>
      a.published_at.localeCompare(b.published_at) ||
      a.version.localeCompare(b.version)
  );

  const summaries: CommitDiffSummary[] = [];

  for (let index = 0; index < orderedVersions.length; index++) {
    const version = orderedVersions[index];
    const start = index === 0 ? null : orderedVersions[index - 1].published_at;
    const inWindow = orderedCommits.filter(
      (commit) =>
        (start === null || commit.committed_at > start) &&
        commit.committed_at <= version.published_at
    );
    if (inWindow.length === 0) continue;
    summaries.push({
      version: version.version,
      title: version.title,
      publishedAt: version.published_at,
      commits: [...inWindow].reverse(),
      counts: countsFor(inWindow),
    });
  }

  const newest = orderedVersions[orderedVersions.length - 1];
  const unreleased = newest
    ? orderedCommits.filter((commit) => commit.committed_at > newest.published_at)
    : orderedCommits;
  if (unreleased.length > 0) {
    summaries.push({
      version: UNRELEASED_VERSION,
      title: UNRELEASED_TITLE,
      publishedAt: unreleased[unreleased.length - 1].committed_at,
      commits: [...unreleased].reverse(),
      counts: countsFor(unreleased),
    });
  }

  return summaries.reverse();
}

const TYPE_LABELS: Record<DiffTypeName, string> = {
  feat: "feature",
  fix: "fix",
  perf: "perf",
  refactor: "refactor",
  docs: "docs",
  test: "test",
  chore: "chore",
  build: "build",
  ci: "ci",
};

export function describeDiffCounts(counts: DiffCounts): string {
  const parts: string[] = [];
  if (counts.other > 0) {
    parts.push(`${counts.other} other`);
  }
  for (const type of DIFF_TYPE_ORDER) {
    const count = counts[type];
    if (count === 0) continue;
    const label = TYPE_LABELS[type];
    parts.push(`${count} ${label}${count === 1 ? "" : "s"}`);
  }
  return parts.length > 0 ? parts.join(", ") : "no typed changes";
}

export function formatCommitDiffMarkdown(
  projectName: string,
  summaries: CommitDiffSummary[]
): string {
  if (summaries.length === 0) {
    return `# ${projectName}\n\nNo commit activity is recorded.\n`;
  }

  const parts = [`# ${projectName} / Commit trail`, ""];
  for (const summary of summaries) {
    const versionLabel =
      summary.version === UNRELEASED_VERSION
        ? UNRELEASED_TITLE
        : `${summary.title} (${summary.version})`;
    parts.push(`## ${versionLabel}`);
    parts.push(`*${summary.publishedAt.slice(0, 10)}*`);
    parts.push("");
    parts.push(
      `Commits: ${summary.commits.length}. ${describeDiffCounts(summary.counts)}.`
    );
    parts.push("");
    for (const commit of summary.commits) {
      parts.push(`- ${commit.message} (\`${commit.sha.slice(0, 7)}\`)`);
    }
    parts.push("");
  }
  return parts.join("\n").trim() + "\n";
}

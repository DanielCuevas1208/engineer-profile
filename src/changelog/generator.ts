import type { GitHubCommit, GitHubRelease } from "../types.js";

const CONVENTIONAL_RE =
  /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore)(\(.+?\))?!?:\s*(.+)/i;

export interface ParsedCommit {
  sha: string;
  type: string;
  scope: string | null;
  description: string;
  breaking: boolean;
  raw: string;
}

export function parseConventionalCommit(
  sha: string,
  message: string
): ParsedCommit | null {
  const firstLine = message.split("\n")[0].trim();
  const match = firstLine.match(CONVENTIONAL_RE);
  if (!match) return null;
  return {
    sha,
    type: match[1].toLowerCase(),
    scope: match[2] ? match[2].slice(1, -1) : null,
    description: match[3].trim(),
    breaking: firstLine.includes("!:") || firstLine.includes("BREAKING CHANGE"),
    raw: firstLine,
  };
}

export interface ChangelogSection {
  version: string;
  title: string;
  body: string;
  source: "release" | "commits";
  source_url?: string | null;
  published_at: string;
  commit_shas: string[];
}

export function changelogFromReleases(
  releases: GitHubRelease[]
): ChangelogSection[] {
  return [...releases]
    .sort((a, b) => b.published_at.localeCompare(a.published_at))
    .map((release) => ({
      version: release.tag_name,
      title: release.name || release.tag_name,
      body: release.body?.trim() || `Release ${release.tag_name}`,
      source: "release" as const,
      source_url: release.html_url,
      published_at: release.published_at,
      commit_shas: [],
    }));
}

export function changelogFromCommits(
  commits: GitHubCommit[],
  version = "unreleased"
): ChangelogSection | null {
  const orderedCommits = [...commits].sort((a, b) =>
    b.commit.author.date.localeCompare(a.commit.author.date)
  );
  const parsed = orderedCommits
    .map((commit) => parseConventionalCommit(commit.sha, commit.commit.message))
    .filter((item): item is ParsedCommit => item !== null);

  if (parsed.length === 0 && orderedCommits.length === 0) return null;

  const groups = new Map<string, ParsedCommit[]>();
  for (const item of parsed) {
    const list = groups.get(item.type) ?? [];
    list.push(item);
    groups.set(item.type, list);
  }

  const lines: string[] = [];
  const typeOrder = ["feat", "fix", "perf", "refactor", "docs", "test", "chore", "ci", "build"];

  for (const type of typeOrder) {
    const items = groups.get(type);
    if (!items?.length) continue;
    const heading = type.charAt(0).toUpperCase() + type.slice(1);
    lines.push(`### ${heading}`);
    for (const item of items) {
      const scope = item.scope ? `**${item.scope}:** ` : "";
      const breaking = item.breaking ? " **BREAKING**" : "";
      lines.push(`- ${scope}${item.description}${breaking} (\`${item.sha.slice(0, 7)}\`)`);
    }
    lines.push("");
  }

  const unparsed = orderedCommits.filter(
    (commit) => !parseConventionalCommit(commit.sha, commit.commit.message)
  );
  if (unparsed.length > 0) {
    lines.push("### Other changes");
    for (const commit of unparsed.slice(0, 20)) {
      const message = commit.commit.message.split("\n")[0].trim();
      lines.push(`- ${message} (\`${commit.sha.slice(0, 7)}\`)`);
    }
    lines.push("");
  }

  if (lines.length === 0) return null;

  return {
    version,
    title: "Unreleased changes",
    body: lines.join("\n").trim(),
    source: "commits",
    source_url: null,
    published_at: orderedCommits[0]?.commit.author.date ?? new Date(0).toISOString(),
    commit_shas: orderedCommits.map((commit) => commit.sha),
  };
}

export function buildChangelog(
  releases: GitHubRelease[],
  commits: GitHubCommit[]
): ChangelogSection[] {
  const fromReleases = changelogFromReleases(releases);
  if (fromReleases.length > 0) return fromReleases;

  const fromCommits = changelogFromCommits(commits);
  return fromCommits ? [fromCommits] : [];
}

export function formatChangelogMarkdown(sections: ChangelogSection[]): string {
  if (sections.length === 0) return "# Changelog\n\nNo published changes yet.\n";

  const parts = ["# Changelog", ""];
  for (const section of sections) {
    parts.push(`## ${section.title} (${section.version})`);
    parts.push(`*${section.source} | ${section.published_at.slice(0, 10)}*`);
    if (section.source_url) parts.push(`Source: ${section.source_url}`);
    parts.push("");
    parts.push(section.body);
    parts.push("");
  }
  return parts.join("\n");
}
import { isCommitMessageAllowed } from "../privacy/controls.js";
import type {
  GitHubCommit,
  GitHubRelease,
  GitHubRepo,
  PrivacyConfig,
} from "../types.js";

const GITHUB_API = "https://api.github.com";
const MAX_PAGE_SIZE = 100;

export class GitHubClient {
  constructor(private readonly token?: string) {}

  private headers(): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "User-Agent": "engineer-profile/0.1.0",
    };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    return headers;
  }

  async fetchJson<T>(url: string): Promise<T> {
    const response = await fetch(url, {
      headers: this.headers(),
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) {
      throw new Error(`GitHub API error ${response.status}: ${url}`);
    }
    return (await response.json()) as T;
  }

  async getRepo(owner: string, repo: string): Promise<GitHubRepo> {
    const data = await this.fetchJson<GitHubRepo & { topics?: string[] }>(
      `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`
    );
    return { ...data, topics: data.topics ?? [] };
  }

  async getCommits(owner: string, repo: string, limit = 30): Promise<GitHubCommit[]> {
    const pageSize = Math.min(Math.max(limit, 1), MAX_PAGE_SIZE);
    return this.fetchJson<GitHubCommit[]>(
      `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits?per_page=${pageSize}`
    );
  }

  async getReleases(owner: string, repo: string): Promise<GitHubRelease[]> {
    return this.fetchJson<GitHubRelease[]>(
      `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/releases?per_page=10`
    );
  }

  async listPublicRepos(owner: string, limit = 10): Promise<GitHubRepo[]> {
    const pageSize = Math.min(Math.max(limit, 1), MAX_PAGE_SIZE);
    const repos = await this.fetchJson<Array<GitHubRepo & { topics?: string[] }>>(
      `${GITHUB_API}/users/${encodeURIComponent(owner)}/repos?sort=pushed&per_page=${pageSize}`
    );
    return repos.map((repo) => ({ ...repo, topics: repo.topics ?? [] }));
  }
}

export function slugFromFullName(fullName: string): string {
  return fullName.trim().replace(/\//g, "-").toLowerCase();
}

export function repoToProjectRecord(
  repo: GitHubRepo,
  privacy: PrivacyConfig,
  ingestedAt = new Date().toISOString()
): {
  slug: string;
  name: string;
  description: string | null;
  url: string;
  homepage: string | null;
  language: string | null;
  stars: number;
  forks: number;
  topics: string;
  last_pushed: string;
  visible: number;
  screenshot_path: string | null;
  ingested_at: string;
} {
  const slug = slugFromFullName(repo.full_name);
  const hidden = privacy.hiddenProjects.includes(slug) || repo.private;
  return {
    slug,
    name: repo.name,
    description: repo.description,
    url: repo.html_url,
    homepage: repo.homepage,
    language: repo.language,
    stars: repo.stargazers_count,
    forks: repo.forks_count,
    topics: JSON.stringify(repo.topics),
    last_pushed: repo.pushed_at,
    visible: hidden ? 0 : 1,
    screenshot_path: null,
    ingested_at: ingestedAt,
  };
}

export function filterCommitsByPrivacy(
  commits: GitHubCommit[],
  privacy: PrivacyConfig
): GitHubCommit[] {
  return commits
    .filter((commit) => isCommitMessageAllowed(commit.commit.message))
    .slice(0, privacy.maxCommitsPerProject);
}

export function commitsToRows(
  commits: GitHubCommit[],
  privacy: PrivacyConfig
): Array<{
  sha: string;
  message: string;
  author_name: string | null;
  author_email: string | null;
  committed_at: string;
  url: string;
}> {
  return filterCommitsByPrivacy(commits, privacy)
    .map((commit) => ({
      sha: commit.sha,
      message: commit.commit.message.split("\n")[0].trim(),
      author_name: commit.commit.author.name,
      author_email: privacy.redactEmails ? null : commit.commit.author.email,
      committed_at: commit.commit.author.date,
      url: commit.html_url,
    }));
}
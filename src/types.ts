export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  homepage: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  pushed_at: string;
  topics: string[];
  default_branch: string;
  private: boolean;
}

export interface GitHubCommit {
  sha: string;
  commit: {
    message: string;
    author: {
      name: string;
      email: string;
      date: string;
    };
  };
  html_url: string;
}

export interface GitHubRelease {
  id: number;
  tag_name: string;
  name: string;
  body: string | null;
  published_at: string;
  html_url: string;
}

export interface ProjectRecord {
  id: number;
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
}

export interface ChangelogEntry {
  id: number;
  project_id: number;
  version: string;
  title: string;
  body: string;
  source: "release" | "commits";
  source_url: string | null;
  published_at: string;
  commit_shas: string;
}

export interface IngestResult {
  project: ProjectRecord;
  commits: GitHubCommit[];
  releases: GitHubRelease[];
  changelogEntries: ChangelogEntry[];
}

export interface PrivacyConfig {
  hiddenProjects: string[];
  redactEmails: boolean;
  maxCommitsPerProject: number;
}

export interface PortfolioConfig {
  owner: string;
  title: string;
  tagline: string;
  dataDir: string;
  outputDir: string;
  privacy: PrivacyConfig;
  clock: () => string;
}

export const DEFAULT_PRIVACY: PrivacyConfig = {
  hiddenProjects: [],
  redactEmails: true,
  maxCommitsPerProject: 50,
};

export const DEFAULT_CONFIG: PortfolioConfig = {
  owner: "demo-engineer",
  title: "EngineerProfile",
  tagline: "A living index of shipped systems, maintained from repository evidence",
  dataDir: "data",
  outputDir: "output",
  privacy: DEFAULT_PRIVACY,
  clock: () => new Date().toISOString(),
};
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
  stats?: {
    additions: number;
    deletions: number;
    total: number;
  };
  files?: Array<{
    filename: string;
    additions: number;
    deletions: number;
    status: string;
  }>;
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

export interface ThemeConfig {
  name: string;
  customCss: string | null;
}

export type DeploymentPlatform = "none" | "github-pages";

export interface DeploymentConfig {
  platform: DeploymentPlatform;
  cname: string | null;
}

export interface FeedConfig {
  enabled: boolean;
  limit: number;
  description: string | null;
  siteUrl: string | null;
}

export interface PortfolioConfig {
  owner: string;
  title: string;
  tagline: string;
  repositoryLimit?: number;
  dataDir: string;
  outputDir: string;
  privacy: PrivacyConfig;
  theme: ThemeConfig;
  deployment: DeploymentConfig;
  feed: FeedConfig;
  clock: () => string;
}

export const DEFAULT_PRIVACY: PrivacyConfig = {
  hiddenProjects: [],
  redactEmails: true,
  maxCommitsPerProject: 50,
};

export const DEFAULT_THEME: ThemeConfig = {
  name: "midnight",
  customCss: null,
};

export const DEFAULT_DEPLOYMENT: DeploymentConfig = {
  platform: "none",
  cname: null,
};

export const DEFAULT_FEED: FeedConfig = {
  enabled: true,
  limit: 20,
  description: null,
  siteUrl: null,
};

export const DEFAULT_CONFIG = {
  owner: "demo-engineer",
  title: "EngineerProfile",
  tagline: "A living index of shipped systems, maintained from repository evidence",
  repositoryLimit: 5,
  dataDir: "data",
  outputDir: "output",
  privacy: DEFAULT_PRIVACY,
  theme: DEFAULT_THEME,
  deployment: DEFAULT_DEPLOYMENT,
  feed: DEFAULT_FEED,
  clock: () => new Date().toISOString(),
} satisfies PortfolioConfig;

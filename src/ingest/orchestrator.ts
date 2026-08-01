import { buildChangelog } from "../changelog/generator.js";
import { openDatabase } from "../db/client.js";
import {
  commitsToRows,
  filterCommitsByPrivacy,
  GitHubClient,
  repoToProjectRecord,
} from "./github.js";
import type { GitHubCommit, GitHubRelease, GitHubRepo, PortfolioConfig } from "../types.js";

export interface IngestOptions {
  owner: string;
  repo: string;
}

export interface FixtureData {
  repo: GitHubRepo;
  commits: GitHubCommit[];
  releases: GitHubRelease[];
}

export async function ingestRepository(
  config: PortfolioConfig,
  options: IngestOptions,
  fixtureData?: FixtureData
): Promise<{ slug: string; commitsAdded: number; changelogCount: number }> {
  const db = openDatabase(config.dataDir, config.clock);
  try {
    let repo: GitHubRepo;
    let commits: GitHubCommit[];
    let releases: GitHubRelease[];

    if (fixtureData) {
      ({ repo, commits, releases } = fixtureData);
    } else {
      const client = new GitHubClient(process.env.GITHUB_TOKEN);
      repo = await client.getRepo(options.owner, options.repo);
      commits = await client.getCommits(
        options.owner,
        options.repo,
        config.privacy.maxCommitsPerProject
      );
      releases = await client.getReleases(options.owner, options.repo);
    }

    const project = db.upsertProject(
      repoToProjectRecord(repo, config.privacy, config.clock())
    );
    const safeCommits = filterCommitsByPrivacy(commits, config.privacy);
    const commitsAdded = db.upsertCommits(project.id, commitsToRows(safeCommits, config.privacy));
    const sections = buildChangelog(releases, safeCommits);

    db.replaceChangelog(
      project.id,
      sections.map((section) => ({
        version: section.version,
        title: section.title,
        body: section.body,
        source: section.source,
        source_url: section.source_url,
        published_at: section.published_at,
        commit_shas: JSON.stringify(section.commit_shas),
      }))
    );

    db.logIngest(
      "ingest",
      `${project.slug}: ${commitsAdded} new commits, ${sections.length} changelog sections`
    );

    return {
      slug: project.slug,
      commitsAdded,
      changelogCount: sections.length,
    };
  } finally {
    db.close();
  }
}

export async function ingestOwnerRepos(
  config: PortfolioConfig,
  owner: string,
  limit = 5,
  fixtureRepos?: FixtureData[]
): Promise<Array<{ slug: string; commitsAdded: number; changelogCount: number }>> {
  if (fixtureRepos) {
    const results = [];
    for (const fixture of fixtureRepos) {
      const [fixtureOwner, fixtureRepo] = fixture.repo.full_name.split("/");
      results.push(
        await ingestRepository(config, { owner: fixtureOwner, repo: fixtureRepo }, fixture)
      );
    }
    return results;
  }

  const client = new GitHubClient(process.env.GITHUB_TOKEN);
  const repos = await client.listPublicRepos(owner, limit);
  const results = [];
  for (const repo of repos) {
    const [repoOwner, repoName] = repo.full_name.split("/");
    results.push(
      await ingestRepository(config, { owner: repoOwner, repo: repoName })
    );
  }
  return results;
}
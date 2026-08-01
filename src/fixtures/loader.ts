import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { GitHubCommit, GitHubRelease, GitHubRepo } from "../types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export function loadFixtureRepo(name: string): GitHubRepo {
  const path = join(__dirname, "../../fixtures", `${name}-repo.json`);
  return JSON.parse(readFileSync(path, "utf-8")) as GitHubRepo;
}

export function loadFixtureCommits(name: string): GitHubCommit[] {
  const path = join(__dirname, "../../fixtures", `${name}-commits.json`);
  return JSON.parse(readFileSync(path, "utf-8")) as GitHubCommit[];
}

export function loadFixtureReleases(name: string): GitHubRelease[] {
  const path = join(__dirname, "../../fixtures", `${name}-releases.json`);
  return JSON.parse(readFileSync(path, "utf-8")) as GitHubRelease[];
}

export function loadAllFixtures(): Array<{
  repo: GitHubRepo;
  commits: GitHubCommit[];
  releases: GitHubRelease[];
}> {
  const names = ["signal-router", "metrics-kit"];
  return names.map((name) => ({
    repo: loadFixtureRepo(name),
    commits: loadFixtureCommits(name),
    releases: loadFixtureReleases(name),
  }));
}

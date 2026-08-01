import { describe, it, expect } from "vitest";
import {
  loadFixtureRepo,
  loadFixtureCommits,
  loadFixtureReleases,
  loadAllFixtures,
} from "../src/fixtures/loader.js";

describe("fixture loader", () => {
  it("loads signal-router repo metadata", () => {
    const repo = loadFixtureRepo("signal-router");
    expect(repo.full_name).toBe("demo-engineer/signal-router");
    expect(repo.language).toBe("TypeScript");
    expect(repo.topics).toContain("messaging");
  });

  it("loads commits and releases for each fixture project", () => {
    const commits = loadFixtureCommits("metrics-kit");
    const releases = loadFixtureReleases("metrics-kit");
    expect(commits.length).toBeGreaterThan(0);
    expect(releases).toHaveLength(0);
  });

  it("loads all fixtures in deterministic order", () => {
    const fixtures = loadAllFixtures();
    expect(fixtures).toHaveLength(2);
    expect(fixtures[0].repo.name).toBe("signal-router");
    expect(fixtures[1].repo.name).toBe("metrics-kit");
    expect(fixtures[0].releases.length).toBeGreaterThan(0);
  });
});

import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadPortfolioConfig } from "../src/config/loader.js";

const TEST_DIR = join("data", "test-config");
const TEST_FILE = join(TEST_DIR, "portfolio.json");

afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }));

describe("portfolio configuration", () => {
  it("loads presentation, refresh, and privacy settings", () => {
    mkdirSync(TEST_DIR, { recursive: true });
    writeFileSync(TEST_FILE, JSON.stringify({
      owner: "owner",
      title: "Evidence Index",
      repositoryLimit: 3,
      privacy: { hiddenProjects: ["owner-hidden"], redactEmails: false },
    }));

    const config = loadPortfolioConfig(TEST_FILE, () => "2026-07-31T00:00:00.000Z");

    expect(config.owner).toBe("owner");
    expect(config.title).toBe("Evidence Index");
    expect(config.repositoryLimit).toBe(3);
    expect(config.privacy.hiddenProjects).toEqual(["owner-hidden"]);
    expect(config.privacy.redactEmails).toBe(false);
    expect(config.privacy.maxCommitsPerProject).toBe(50);
    expect(config.clock()).toBe("2026-07-31T00:00:00.000Z");
  });

  it("rejects invalid repository limits", () => {
    mkdirSync(TEST_DIR, { recursive: true });
    writeFileSync(TEST_FILE, JSON.stringify({ repositoryLimit: 0 }));

    expect(() => loadPortfolioConfig(TEST_FILE)).toThrow(
      'Configuration field "repositoryLimit" must be an integer from 1 to 100.'
    );
  });

  it("loads a built-in theme by name", () => {
    mkdirSync(TEST_DIR, { recursive: true });
    writeFileSync(TEST_FILE, JSON.stringify({ theme: "paper" }));

    const config = loadPortfolioConfig(TEST_FILE, () => "2026-07-31T00:00:00.000Z");
    expect(config.theme).toEqual({ name: "paper", customCss: null });
  });

  it("loads a custom theme with a CSS overlay", () => {
    mkdirSync(TEST_DIR, { recursive: true });
    writeFileSync(
      TEST_FILE,
      JSON.stringify({ theme: { name: "studio", customCss: "themes/studio.css" } })
    );

    const config = loadPortfolioConfig(TEST_FILE, () => "2026-07-31T00:00:00.000Z");
    expect(config.theme).toEqual({ name: "studio", customCss: "themes/studio.css" });
  });

  it("rejects an unknown theme without a CSS overlay", () => {
    mkdirSync(TEST_DIR, { recursive: true });
    writeFileSync(TEST_FILE, JSON.stringify({ theme: "candy" }));

    expect(() => loadPortfolioConfig(TEST_FILE)).toThrow(/unknown theme "candy"/);
  });

  it("rejects a theme object without a name", () => {
    mkdirSync(TEST_DIR, { recursive: true });
    writeFileSync(TEST_FILE, JSON.stringify({ theme: { customCss: "themes/studio.css" } }));

    expect(() => loadPortfolioConfig(TEST_FILE)).toThrow(
      'Configuration field "theme.name" must be a non-empty string.'
    );
  });

  it("loads a GitHub Pages deployment with a custom domain", () => {
    mkdirSync(TEST_DIR, { recursive: true });
    writeFileSync(
      TEST_FILE,
      JSON.stringify({ deployment: { platform: "github-pages", cname: "engineering.example.com" } })
    );

    const config = loadPortfolioConfig(TEST_FILE, () => "2026-07-31T00:00:00.000Z");
    expect(config.deployment).toEqual({
      platform: "github-pages",
      cname: "engineering.example.com",
    });
  });

  it("rejects an unknown deployment platform", () => {
    mkdirSync(TEST_DIR, { recursive: true });
    writeFileSync(TEST_FILE, JSON.stringify({ deployment: { platform: "ftp" } }));

    expect(() => loadPortfolioConfig(TEST_FILE)).toThrow(
      'Configuration field "deployment.platform" must be "none" or "github-pages".'
    );
  });

  it("rejects an invalid custom domain", () => {
    mkdirSync(TEST_DIR, { recursive: true });
    writeFileSync(
      TEST_FILE,
      JSON.stringify({ deployment: { platform: "github-pages", cname: "not a domain" } })
    );

    expect(() => loadPortfolioConfig(TEST_FILE)).toThrow(
      'Configuration field "deployment.cname" has an invalid domain name "not a domain".'
    );
  });

  it("loads feed settings from the configuration", () => {
    mkdirSync(TEST_DIR, { recursive: true });
    writeFileSync(
      TEST_FILE,
      JSON.stringify({
        feed: {
          enabled: false,
          limit: 5,
          description: "Release notes from public repositories.",
          siteUrl: "https://engineering.example.com",
        },
      })
    );

    const config = loadPortfolioConfig(TEST_FILE, () => "2026-07-31T00:00:00.000Z");
    expect(config.feed).toEqual({
      enabled: false,
      limit: 5,
      description: "Release notes from public repositories.",
      siteUrl: "https://engineering.example.com",
    });
  });

  it("rejects a feed object that is not an object", () => {
    mkdirSync(TEST_DIR, { recursive: true });
    writeFileSync(TEST_FILE, JSON.stringify({ feed: "on" }));

    expect(() => loadPortfolioConfig(TEST_FILE)).toThrow(
      'Configuration field "feed" must be an object.'
    );
  });

  it("rejects an invalid feed limit", () => {
    mkdirSync(TEST_DIR, { recursive: true });
    writeFileSync(TEST_FILE, JSON.stringify({ feed: { limit: 0 } }));

    expect(() => loadPortfolioConfig(TEST_FILE)).toThrow(
      'Configuration field "feed.limit" must be an integer from 1 to 100.'
    );
  });

  it("rejects an invalid feed site URL", () => {
    mkdirSync(TEST_DIR, { recursive: true });
    writeFileSync(TEST_FILE, JSON.stringify({ feed: { siteUrl: "not-a-url" } }));

    expect(() => loadPortfolioConfig(TEST_FILE)).toThrow(
      'Configuration field "feed.siteUrl" must be an absolute http or https URL.'
    );
  });
});

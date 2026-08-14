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

  it("loads theme and deploy settings", () => {
    mkdirSync(TEST_DIR, { recursive: true });
    writeFileSync(TEST_FILE, JSON.stringify({
      theme: { name: "paper", accent: "#0f6bbd", radius: "20px" },
      deploy: { targets: [{ name: "public", type: "local", target: "output/deploy" }] },
    }));

    const config = loadPortfolioConfig(TEST_FILE);
    expect(config.theme.name).toBe("paper");
    expect(config.theme.accent).toBe("#0f6bbd");
    expect(config.theme.radius).toBe("20px");
    expect(config.deploy.targets).toEqual([
      { name: "public", type: "local", target: "output/deploy" },
    ]);
  });

  it("rejects unknown theme names", () => {
    mkdirSync(TEST_DIR, { recursive: true });
    writeFileSync(TEST_FILE, JSON.stringify({ theme: { name: "vaporwave" } }));

    expect(() => loadPortfolioConfig(TEST_FILE)).toThrow(
      'Configuration field "theme.name" must be one of: deep-space, paper, terminal.'
    );
  });

  it("rejects invalid accent colors", () => {
    mkdirSync(TEST_DIR, { recursive: true });
    writeFileSync(TEST_FILE, JSON.stringify({ theme: { name: "deep-space", accent: "blue" } }));

    expect(() => loadPortfolioConfig(TEST_FILE)).toThrow(
      'Configuration field "theme.accent" must be a hex color like "#67b7ff".'
    );
  });

  it("loads feed settings", () => {
    mkdirSync(TEST_DIR, { recursive: true });
    writeFileSync(TEST_FILE, JSON.stringify({
      feed: { baseUrl: "https://portfolio.example.com/" },
    }));

    const config = loadPortfolioConfig(TEST_FILE);
    expect(config.feed.baseUrl).toBe("https://portfolio.example.com");
  });

  it("defaults the feed settings", () => {
    mkdirSync(TEST_DIR, { recursive: true });
    writeFileSync(TEST_FILE, JSON.stringify({ owner: "owner" }));

    const config = loadPortfolioConfig(TEST_FILE);
    expect(config.feed.baseUrl).toBeUndefined();
  });

  it("rejects invalid feed base URLs", () => {
    mkdirSync(TEST_DIR, { recursive: true });
    writeFileSync(TEST_FILE, JSON.stringify({ feed: { baseUrl: "not a url" } }));

    expect(() => loadPortfolioConfig(TEST_FILE)).toThrow(
      'Configuration field "feed.baseUrl" must be an absolute http(s) URL.'
    );
  });

  it("loads s3, netlify, vercel, and rsync deploy settings", () => {
    mkdirSync(TEST_DIR, { recursive: true });
    writeFileSync(TEST_FILE, JSON.stringify({
      deploy: {
        targets: [
          { name: "s3-prod", type: "s3", bucket: "portfolio-bucket", region: "eu-central-1", prefix: "docs" },
          { name: "netlify-preview", type: "netlify", siteId: "site-123" },
          { name: "vercel-prod", type: "vercel", projectId: "prj-456", cleanUrls: true },
          { name: "rsync-backup", type: "rsync", host: "backup.example.com", path: "/srv/backup", port: 2222 },
        ],
      },
    }));

    const config = loadPortfolioConfig(TEST_FILE);
    expect(config.deploy.targets).toHaveLength(4);
    expect(config.deploy.targets[0]).toEqual({
      name: "s3-prod",
      type: "s3",
      bucket: "portfolio-bucket",
      region: "eu-central-1",
      prefix: "docs",
    });
    expect(config.deploy.targets[1]).toEqual({
      name: "netlify-preview",
      type: "netlify",
      siteId: "site-123",
    });
    expect(config.deploy.targets[2]).toEqual({
      name: "vercel-prod",
      type: "vercel",
      projectId: "prj-456",
      cleanUrls: true,
    });
    expect(config.deploy.targets[3]).toEqual({
      name: "rsync-backup",
      type: "rsync",
      host: "backup.example.com",
      path: "/srv/backup",
      port: 2222,
    });
  });

  it("rejects unsupported deploy adapter types", () => {
    mkdirSync(TEST_DIR, { recursive: true });
    writeFileSync(TEST_FILE, JSON.stringify({
      deploy: { targets: [{ name: "ftp-target", type: "ftp", target: "x" }] },
    }));

    expect(() => loadPortfolioConfig(TEST_FILE)).toThrow(
      'Configuration field "deploy.targets[0].type" must be one of: local, s3, netlify, vercel, rsync.'
    );
  });

  it("rejects invalid S3 bucket names in configuration", () => {
    mkdirSync(TEST_DIR, { recursive: true });
    writeFileSync(TEST_FILE, JSON.stringify({
      deploy: { targets: [{ name: "bad-s3", type: "s3", bucket: "INVALID_BUCKET_NAME" }] },
    }));

    expect(() => loadPortfolioConfig(TEST_FILE)).toThrow(
      'Configuration field "deploy.targets[0].bucket" must be a valid S3 bucket name.'
    );
  });

  it("rejects invalid rsync ports in configuration", () => {
    mkdirSync(TEST_DIR, { recursive: true });
    writeFileSync(TEST_FILE, JSON.stringify({
      deploy: { targets: [{ name: "bad-rsync", type: "rsync", host: "example.com", path: "/var/www", port: 99999 }] },
    }));

    expect(() => loadPortfolioConfig(TEST_FILE)).toThrow(
      'Configuration field "deploy.targets[0].port" must be an integer from 1 to 65535.'
    );
  });
});

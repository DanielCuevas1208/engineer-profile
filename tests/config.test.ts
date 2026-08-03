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
      theme: "light",
      deploy: { adapter: "vercel" },
      privacy: { hiddenProjects: ["owner-hidden"], redactEmails: false },
    }));

    const config = loadPortfolioConfig(TEST_FILE, () => "2026-07-31T00:00:00.000Z");

    expect(config.owner).toBe("owner");
    expect(config.title).toBe("Evidence Index");
    expect(config.repositoryLimit).toBe(3);
    expect(config.theme).toBe("light");
    expect(config.deploy.adapter).toBe("vercel");
    expect(config.deploy.domain).toBeUndefined();
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

  it("rejects unknown theme names", () => {
    mkdirSync(TEST_DIR, { recursive: true });
    writeFileSync(TEST_FILE, JSON.stringify({ theme: "rainbow" }));

    expect(() => loadPortfolioConfig(TEST_FILE)).toThrow(
      'Configuration field "theme" must be one of:'
    );
  });

  it("rejects unknown deploy adapters", () => {
    mkdirSync(TEST_DIR, { recursive: true });
    writeFileSync(TEST_FILE, JSON.stringify({ deploy: { adapter: "ftp" } }));

    expect(() => loadPortfolioConfig(TEST_FILE)).toThrow(
      'Configuration field "deploy.adapter" must be one of:'
    );
  });

  it("accepts a deploy domain and rejects empty domains", () => {
    mkdirSync(TEST_DIR, { recursive: true });
    writeFileSync(TEST_FILE, JSON.stringify({
      deploy: { adapter: "gh-pages", domain: "docs.example.dev" },
    }));
    expect(loadPortfolioConfig(TEST_FILE).deploy.domain).toBe("docs.example.dev");

    writeFileSync(TEST_FILE, JSON.stringify({ deploy: { adapter: "gh-pages", domain: "  " } }));
    expect(() => loadPortfolioConfig(TEST_FILE)).toThrow(
      'Configuration field "deploy.domain" must be a non-empty string.'
    );
  });
});

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

  it("rejects unsupported deploy adapter types", () => {
    mkdirSync(TEST_DIR, { recursive: true });
    writeFileSync(TEST_FILE, JSON.stringify({
      deploy: { targets: [{ name: "netlify", type: "remote", target: "x" }] },
    }));

    expect(() => loadPortfolioConfig(TEST_FILE)).toThrow(
      'Configuration field "deploy.targets[0].type" must be "local".'
    );
  });
});

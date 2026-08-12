import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { deployAll, deployToTarget, previewAll, previewToTarget } from "../src/deploy/index.js";
import { openDatabase } from "../src/db/client.js";
import { digestSnapshot } from "../src/deploy/snapshot.js";
import { DEFAULT_CONFIG } from "../src/types.js";

const TEST_DATA = join("data", "test-deploy");
const TEST_OUTPUT = join("output", "test-deploy");
const TEST_TARGET = join("deploy", "test-deploy-target");

describe("deploy adapters", () => {
  beforeEach(() => {
    rmSync(TEST_DATA, { recursive: true, force: true });
    rmSync(TEST_OUTPUT, { recursive: true, force: true });
    rmSync(TEST_TARGET, { recursive: true, force: true });
  });

  afterEach(() => {
    rmSync(TEST_DATA, { recursive: true, force: true });
    rmSync(TEST_OUTPUT, { recursive: true, force: true });
    rmSync(TEST_TARGET, { recursive: true, force: true });
  });

  function publishedConfig() {
    const config = {
      ...DEFAULT_CONFIG,
      dataDir: TEST_DATA,
      outputDir: TEST_OUTPUT,
      deploy: {
        targets: [{ name: "public", type: "local" as const, target: TEST_TARGET }],
      },
      clock: () => "2026-07-31T00:00:00.000Z",
    };
    return config;
  }

  function writePublishedSite() {
    mkdirSync(join(TEST_OUTPUT, "assets", "screenshots"), { recursive: true });
    writeFileSync(join(TEST_OUTPUT, "index.html"), "<html>portfolio</html>", "utf-8");
    writeFileSync(join(TEST_OUTPUT, "site-manifest.json"), "{}", "utf-8");
  }

  it("copies the published site into a local target", () => {
    writePublishedSite();
    const config = publishedConfig();
    const result = deployAll(config);

    expect(result).toHaveLength(1);
    expect(result[0].targetName).toBe("public");
    expect(result[0].targetPath).toBe(TEST_TARGET);
    expect(result[0].files).toBeGreaterThanOrEqual(2);
    expect(result[0].removed).toBe(0);
    expect(result[0].verified).toBe(true);
    expect(result[0].sourceDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(result[0].targetDigest).toBe(result[0].sourceDigest);
    expect(existsSync(join(TEST_TARGET, "index.html"))).toBe(true);
    expect(existsSync(join(TEST_TARGET, "site-manifest.json"))).toBe(true);
  });

  it("removes stale files that are not part of the snapshot", () => {
    writePublishedSite();
    mkdirSync(join(TEST_TARGET, "assets"), { recursive: true });
    writeFileSync(join(TEST_TARGET, "old-capture.png"), "stale", "utf-8");
    const config = publishedConfig();

    const result = deployAll(config);

    expect(result[0].removed).toBe(1);
    expect(existsSync(join(TEST_TARGET, "old-capture.png"))).toBe(false);
    expect(existsSync(join(TEST_TARGET, "index.html"))).toBe(true);
  });

  it("reports an unverified result when the manifest is missing", () => {
    mkdirSync(TEST_OUTPUT, { recursive: true });
    writeFileSync(join(TEST_OUTPUT, "index.html"), "<html>partial</html>", "utf-8");
    const config = publishedConfig();

    const result = deployAll(config);

    expect(result[0].verified).toBe(false);
    expect(result[0].files).toBe(1);
  });

  it("previews added, changed, removed, and unchanged files without writing the target", () => {
    writePublishedSite();
    writeFileSync(join(TEST_OUTPUT, "new.txt"), "new", "utf-8");
    mkdirSync(TEST_TARGET, { recursive: true });
    writeFileSync(join(TEST_TARGET, "index.html"), "old", "utf-8");
    writeFileSync(join(TEST_TARGET, "site-manifest.json"), "{}", "utf-8");
    writeFileSync(join(TEST_TARGET, "stale.txt"), "stale", "utf-8");
    const config = publishedConfig();

    const result = previewAll(config);

    expect(result[0]).toMatchObject({
      targetName: "public",
      status: "changed",
      added: ["new.txt"],
      changed: ["index.html"],
      removed: ["stale.txt"],
      unchanged: 1,
      files: 3,
    });
    expect(readFileSync(join(TEST_TARGET, "index.html"), "utf-8")).toBe("old");
    expect(existsSync(join(TEST_TARGET, "stale.txt"))).toBe(true);
  });

  it("previews a missing target without creating its directory", () => {
    writePublishedSite();
    const config = publishedConfig();

    const result = previewToTarget(config, config.deploy.targets[0]);

    expect(result.status).toBe("changed");
    expect(result.added).toEqual(["index.html", "site-manifest.json"]);
    expect(result.changed).toEqual([]);
    expect(result.removed).toEqual([]);
    expect(result.sourceDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(result.targetDigest).toBeNull();
    expect(existsSync(TEST_TARGET)).toBe(false);
  });

  it("produces a stable digest for the same snapshot and changes it when content changes", () => {
    writePublishedSite();
    const first = digestSnapshot(TEST_OUTPUT);
    const second = digestSnapshot(TEST_OUTPUT);

    expect(first).toBe(second);
    expect(first).toMatch(/^[a-f0-9]{64}$/);

    writeFileSync(join(TEST_OUTPUT, "index.html"), "<html>changed</html>", "utf-8");
    expect(digestSnapshot(TEST_OUTPUT)).not.toBe(first);
  });

  it("reports a clean preview when both snapshots match", () => {
    writePublishedSite();
    const config = publishedConfig();
    deployAll(config);

    const result = previewToTarget(config, config.deploy.targets[0]);

    expect(result.status).toBe("clean");
    expect(result.added).toEqual([]);
    expect(result.changed).toEqual([]);
    expect(result.removed).toEqual([]);
    expect(result.unchanged).toBe(result.files);
  });

  it("reports a publish-first error when output is missing", () => {
    const config = publishedConfig();
    expect(() => deployToTarget(config, config.deploy.targets[0])).toThrow(
      /No published site found/
    );
  });

  it("rejects a target inside the output directory", () => {
    writePublishedSite();
    const config = {
      ...publishedConfig(),
      deploy: {
        targets: [
          { name: "nested", type: "local" as const, target: join(TEST_OUTPUT, "nested") },
        ],
      },
    };
    expect(() => deployAll(config)).toThrow(/must be outside the output directory/);
  });

  it("returns an empty result list without targets", () => {
    const config = { ...publishedConfig(), deploy: { targets: [] } };
    expect(deployAll(config)).toEqual([]);
  });

  it("records a deploy audit entry", () => {
    writePublishedSite();
    const config = publishedConfig();
    deployAll(config);

    const db = openDatabase(TEST_DATA, config.clock);
    const log = db.getIngestLog(5);
    db.close();
    expect(log[0].action).toBe("deploy");
    expect(log[0].detail).toContain("public");
  });

  it("copies subdirectories inside the output directory", () => {
    writePublishedSite();
    writeFileSync(
      join(TEST_OUTPUT, "assets", "screenshots", "demo-engineer-signal-router.png"),
      "png",
      "utf-8"
    );
    const config = publishedConfig();
    deployAll(config);

    const targetFiles = readdirSync(join(TEST_TARGET, "assets", "screenshots"));
    expect(targetFiles).toContain("demo-engineer-signal-router.png");
  });
});

import { describe, expect, it, afterEach } from "vitest";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { deployPortfolio } from "../src/deploy/run.js";
import { isKnownAdapter, listAdapters, resolveAdapter } from "../src/deploy/adapters.js";
import { openDatabase } from "../src/db/client.js";
import { DEFAULT_CONFIG } from "../src/types.js";

const TEST_DATA = join("data", "test-deploy");
const TEST_OUTPUT = join("output", "test-deploy");
const TEST_TARGET = join("output", "test-deploy-target");

function configFor(overrides: Partial<typeof DEFAULT_CONFIG> = {}) {
  return {
    ...DEFAULT_CONFIG,
    dataDir: TEST_DATA,
    outputDir: TEST_OUTPUT,
    clock: () => "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

afterEach(() => {
  for (const path of [TEST_DATA, TEST_OUTPUT, TEST_TARGET]) {
    rmSync(path, { recursive: true, force: true });
  }
});

describe("deployment adapters", () => {
  it("lists the built-in adapters", () => {
    expect(listAdapters()).toEqual(["none", "local"]);
  });

  it("recognizes every built-in adapter name", () => {
    for (const name of listAdapters()) {
      expect(isKnownAdapter(name)).toBe(true);
    }
  });

  it("resolves known adapter names", () => {
    expect(resolveAdapter("local").name).toBe("local");
    expect(resolveAdapter("none").name).toBe("none");
  });

  it("rejects unknown adapter names", () => {
    expect(() => resolveAdapter("surge")).toThrow(/Unknown deployment adapter/);
  });

  it("does nothing with the none adapter", () => {
    const result = deployPortfolio(configFor());
    expect(result.adapter).toBe("none");
    expect(result.target).toBeNull();
    expect(result.filesCopied).toBe(0);
  });
});

describe("local deployment", () => {
  it("mirrors the output directory into the target", () => {
    mkdirSync(join(TEST_OUTPUT, "assets", "screenshots"), { recursive: true });
    writeFileSync(join(TEST_OUTPUT, "index.html"), "<html>site</html>");
    writeFileSync(join(TEST_OUTPUT, "assets", "screenshots", "a.png"), "png");

    const result = deployPortfolio(configFor({ deploy: { adapter: "local", targetDir: TEST_TARGET } }));

    expect(result.adapter).toBe("local");
    expect(result.filesCopied).toBe(2);
    expect(existsSync(join(TEST_TARGET, "index.html"))).toBe(true);
    expect(readFileSync(join(TEST_TARGET, "index.html"), "utf-8")).toBe("<html>site</html>");
    expect(existsSync(join(TEST_TARGET, "assets", "screenshots", "a.png"))).toBe(true);
  });

  it("replaces the previous target contents", () => {
    mkdirSync(TEST_TARGET, { recursive: true });
    writeFileSync(join(TEST_TARGET, "stale.txt"), "old");
    mkdirSync(TEST_OUTPUT, { recursive: true });
    writeFileSync(join(TEST_OUTPUT, "index.html"), "<html>fresh</html>");

    deployPortfolio(configFor({ deploy: { adapter: "local", targetDir: TEST_TARGET } }));

    expect(existsSync(join(TEST_TARGET, "stale.txt"))).toBe(false);
    expect(existsSync(join(TEST_TARGET, "index.html"))).toBe(true);
  });

  it("requires a target directory for the local adapter", () => {
    mkdirSync(TEST_OUTPUT, { recursive: true });
    expect(() =>
      deployPortfolio(configFor({ deploy: { adapter: "local" } }))
    ).toThrow(/targetDir/);
  });

  it("rejects a target that overlaps the output directory", () => {
    mkdirSync(TEST_OUTPUT, { recursive: true });
    expect(() =>
      deployPortfolio(configFor({ deploy: { adapter: "local", targetDir: TEST_OUTPUT } }))
    ).toThrow(/must not overlap/);
  });

  it("rejects a target nested inside the output directory", () => {
    mkdirSync(TEST_OUTPUT, { recursive: true });
    expect(() =>
      deployPortfolio(configFor({ deploy: { adapter: "local", targetDir: join(TEST_OUTPUT, "nested") } }))
    ).toThrow(/must not overlap/);
  });

  it("rejects a missing output directory", () => {
    expect(() =>
      deployPortfolio(configFor({ deploy: { adapter: "local", targetDir: TEST_TARGET } }))
    ).toThrow(/Nothing to deploy/);
  });

  it("supports a one-off target override with the none adapter", () => {
    mkdirSync(TEST_OUTPUT, { recursive: true });
    writeFileSync(join(TEST_OUTPUT, "index.html"), "<html>site</html>");
    const result = deployPortfolio(configFor(), { adapter: "local", targetDir: TEST_TARGET });
    expect(result.adapter).toBe("local");
    expect(existsSync(join(TEST_TARGET, "index.html"))).toBe(true);
  });

  it("records the deployment in the audit trail", () => {
    mkdirSync(TEST_OUTPUT, { recursive: true });
    writeFileSync(join(TEST_OUTPUT, "index.html"), "<html>site</html>");
    deployPortfolio(configFor({ deploy: { adapter: "local", targetDir: TEST_TARGET } }));

    const db = openDatabase(TEST_DATA, () => "2026-01-01T00:00:00.000Z");
    const log = db.getIngestLog(5);
    db.close();
    expect(log.some((entry) => entry.action === "deploy")).toBe(true);
  });
});

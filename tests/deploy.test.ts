import { afterEach, describe, expect, it } from "vitest";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { prepareDeployment } from "../src/deploy/adapters.js";
import { DEFAULT_CONFIG } from "../src/types.js";

const TEST_DATA = join("data", "test-deploy");
const TEST_OUTPUT = join("output", "test-deploy");

afterEach(() => {
  rmSync(TEST_DATA, { recursive: true, force: true });
  rmSync(TEST_OUTPUT, { recursive: true, force: true });
});

describe("deployment preparation", () => {
  it("writes no-jekyll markers for GitHub Pages", () => {
    const config = {
      ...DEFAULT_CONFIG,
      dataDir: TEST_DATA,
      outputDir: TEST_OUTPUT,
      deployment: { platform: "github-pages" as const, cname: null },
    };

    const result = prepareDeployment(config);

    expect(result.prepared).toBe(true);
    expect(result.platform).toBe("github-pages");
    expect(result.files).toEqual([".nojekyll"]);
    expect(existsSync(join(TEST_OUTPUT, ".nojekyll"))).toBe(true);
  });

  it("writes a CNAME file when a custom domain is configured", () => {
    const config = {
      ...DEFAULT_CONFIG,
      dataDir: TEST_DATA,
      outputDir: TEST_OUTPUT,
      deployment: { platform: "github-pages" as const, cname: "engineering.example.com" },
    };

    const result = prepareDeployment(config);

    expect(result.files).toContain("CNAME");
    const cname = readFileSync(join(TEST_OUTPUT, "CNAME"), "utf-8").trim();
    expect(cname).toBe("engineering.example.com");
  });

  it("does nothing when no platform is configured", () => {
    const config = {
      ...DEFAULT_CONFIG,
      dataDir: TEST_DATA,
      outputDir: TEST_OUTPUT,
      deployment: { platform: "none" as const, cname: null },
    };

    const result = prepareDeployment(config);

    expect(result.prepared).toBe(false);
    expect(result.files).toEqual([]);
    expect(existsSync(join(TEST_OUTPUT, ".nojekyll"))).toBe(false);
  });
});

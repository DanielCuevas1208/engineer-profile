import { afterEach, describe, expect, it } from "vitest";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import {
  applyDeployAdapter,
  listDeployAdapters,
  resolveAdapter,
} from "../src/deploy/index.js";
import { openDatabase } from "../src/db/client.js";
import { DEFAULT_CONFIG } from "../src/types.js";

const TEST_DATA = join("data", "test-deploy");
const TEST_OUTPUT = join("output", "test-deploy");

function deployConfig(outputDir: string) {
  return { ...DEFAULT_CONFIG, dataDir: TEST_DATA, outputDir };
}

afterEach(() => {
  rmSync(TEST_DATA, { recursive: true, force: true });
  rmSync(TEST_OUTPUT, { recursive: true, force: true });
});

describe("deployment adapters", () => {
  it("registers the built-in adapters", () => {
    expect(listDeployAdapters().map((adapter) => adapter.name)).toEqual([
      "gh-pages",
      "vercel",
      "netlify",
      "surge",
      "none",
    ]);
  });

  it("writes nojekyll and CNAME for GitHub Pages with a domain", () => {
    const result = applyDeployAdapter(
      { ...deployConfig(TEST_OUTPUT), deploy: { adapter: "gh-pages", domain: "example.dev" } }
    );
    expect(result.files).toEqual([".nojekyll", "CNAME"]);
    expect(existsSync(join(TEST_OUTPUT, ".nojekyll"))).toBe(true);
    expect(readFileSync(join(TEST_OUTPUT, "CNAME"), "utf-8").trim()).toBe("example.dev");
  });

  it("skips CNAME for GitHub Pages without a domain", () => {
    const result = applyDeployAdapter(
      { ...deployConfig(TEST_OUTPUT), deploy: { adapter: "gh-pages" } }
    );
    expect(result.files).toEqual([".nojekyll"]);
    expect(existsSync(join(TEST_OUTPUT, "CNAME"))).toBe(false);
  });

  it("writes a caching config for Vercel", () => {
    applyDeployAdapter({ ...deployConfig(TEST_OUTPUT), deploy: { adapter: "vercel" } });
    const vercel = JSON.parse(readFileSync(join(TEST_OUTPUT, "vercel.json"), "utf-8")) as {
      cleanUrls: boolean;
      headers: Array<{ source: string }>;
    };
    expect(vercel.cleanUrls).toBe(true);
    expect(vercel.headers[0].source).toBe("/assets/screenshots/(.*)");
  });

  it("writes cache headers for Netlify", () => {
    applyDeployAdapter({ ...deployConfig(TEST_OUTPUT), deploy: { adapter: "netlify" } });
    const toml = readFileSync(join(TEST_OUTPUT, "netlify.toml"), "utf-8");
    expect(toml).toContain("[build]");
    expect(toml).toContain("max-age=31536000");
  });

  it("requires a domain for Surge", () => {
    const result = applyDeployAdapter(
      { ...deployConfig(TEST_OUTPUT), deploy: { adapter: "surge", domain: "site.surge.sh" } }
    );
    expect(result.files).toEqual(["CNAME"]);
    expect(readFileSync(join(TEST_OUTPUT, "CNAME"), "utf-8").trim()).toBe("site.surge.sh");
  });

  it("writes nothing for the local-only adapter", () => {
    const result = applyDeployAdapter({ ...deployConfig(TEST_OUTPUT), deploy: { adapter: "none" } });
    expect(result.files).toEqual([]);
    expect(existsSync(join(TEST_OUTPUT, ".nojekyll"))).toBe(false);
    expect(existsSync(join(TEST_OUTPUT, "CNAME"))).toBe(false);
  });

  it("rejects unknown adapters", () => {
    expect(() => resolveAdapter("unknown")).toThrow(/Unknown deployment adapter "unknown"/);
    expect(() => applyDeployAdapter({ ...deployConfig(TEST_OUTPUT), deploy: { adapter: "unknown" } }))
      .toThrow(/Unknown deployment adapter "unknown"/);
  });

  it("records the deployment in the audit log", () => {
    applyDeployAdapter(
      { ...deployConfig(TEST_OUTPUT), deploy: { adapter: "vercel" } }
    );
    const db = openDatabase(TEST_DATA);
    const log = db.getIngestLog(5);
    db.close();
    expect(log.some((entry) => entry.action === "deploy" && entry.detail === "vercel")).toBe(true);
  });
});

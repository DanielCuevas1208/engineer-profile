import { describe, expect, it } from "vitest";
import { createDeployReport } from "../src/deploy/report.js";

describe("deployment reports", () => {
  it("creates deterministic machine-readable metadata", () => {
    const target = {
      targetName: "public",
      targetPath: "deploy/public",
      status: "changed" as const,
      added: ["index.html"],
      changed: [],
      removed: [],
      unchanged: 0,
      files: 1,
      sourceDigest: "a".repeat(64),
      targetDigest: null,
    };
    const report = createDeployReport(
      "preview",
      "2026-07-31T00:00:00.000Z",
      "output",
      [target]
    );

    expect(report).toEqual({
      formatVersion: 1,
      mode: "preview",
      generatedAt: "2026-07-31T00:00:00.000Z",
      outputDir: "output",
      targets: [target],
    });
    expect(JSON.stringify(report)).toBe(JSON.stringify(createDeployReport(
      "preview",
      "2026-07-31T00:00:00.000Z",
      "output",
      [target]
    )));
  });

  it("keeps sync reports separate from preview file changes", () => {
    const digest = "b".repeat(64);
    const report = createDeployReport("sync", "2026-07-31T00:00:00.000Z", "output", [{
      targetName: "public",
      targetPath: "deploy/public",
      files: 4,
      removed: 1,
      verified: true,
      sourceDigest: digest,
      targetDigest: digest,
    }]);

    expect(report.mode).toBe("sync");
    expect(report.targets[0]).toMatchObject({
      targetName: "public",
      verified: true,
      sourceDigest: digest,
      targetDigest: digest,
    });
  });
});

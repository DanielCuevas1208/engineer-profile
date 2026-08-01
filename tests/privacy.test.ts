import { describe, it, expect } from "vitest";
import {
  isProjectVisible,
  redactEmail,
  filterCommitMessages,
  mergePrivacy,
  parsePrivacyJson,
} from "../src/privacy/controls.js";

describe("isProjectVisible", () => {
  it("returns true for visible projects", () => {
    expect(isProjectVisible("my-project", { hiddenProjects: [], redactEmails: true, maxCommitsPerProject: 50 })).toBe(true);
  });

  it("returns false for hidden projects", () => {
    expect(isProjectVisible("secret", { hiddenProjects: ["secret"], redactEmails: true, maxCommitsPerProject: 50 })).toBe(false);
  });
});

describe("redactEmail", () => {
  it("redacts email when enabled", () => {
    const result = redactEmail("alice@example.com", { hiddenProjects: [], redactEmails: true, maxCommitsPerProject: 50 });
    expect(result).toBe("a***@example.com");
  });

  it("preserves email when disabled", () => {
    const result = redactEmail("alice@example.com", { hiddenProjects: [], redactEmails: false, maxCommitsPerProject: 50 });
    expect(result).toBe("alice@example.com");
  });

  it("returns null for null input", () => {
    expect(redactEmail(null, { hiddenProjects: [], redactEmails: true, maxCommitsPerProject: 50 })).toBeNull();
  });
});

describe("filterCommitMessages", () => {
  it("removes messages with sensitive patterns", () => {
    const filtered = filterCommitMessages([
      "feat: add login",
      "fix: rotate api_key",
      "docs: update readme",
    ]);
    expect(filtered).toEqual(["feat: add login", "docs: update readme"]);
  });
});

describe("mergePrivacy", () => {
  it("merges overrides into base config", () => {
    const base = { hiddenProjects: ["a"], redactEmails: true, maxCommitsPerProject: 50 };
    const merged = mergePrivacy(base, { maxCommitsPerProject: 100 });
    expect(merged.maxCommitsPerProject).toBe(100);
    expect(merged.hiddenProjects).toEqual(["a"]);
  });
});

describe("parsePrivacyJson", () => {
  it("parses valid JSON config", () => {
    const config = parsePrivacyJson('{"hiddenProjects":["x"],"redactEmails":false}');
    expect(config.hiddenProjects).toEqual(["x"]);
    expect(config.redactEmails).toBe(false);
  });
});

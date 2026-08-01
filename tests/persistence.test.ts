import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { rmSync } from "node:fs";
import { openDatabase } from "../src/db/client.js";

const TEST_DATA = "data/test-persistence";

beforeEach(() => rmSync(TEST_DATA, { recursive: true, force: true }));
afterEach(() => rmSync(TEST_DATA, { recursive: true, force: true }));

describe("refresh persistence", () => {
  it("preserves privacy and previews during metadata refresh", () => {
    const db = openDatabase(TEST_DATA);
    const project = db.upsertProject({
      slug: "owner-repo",
      name: "Repo",
      description: "Before refresh",
      url: "https://github.com/owner/repo",
      homepage: null,
      language: "TypeScript",
      stars: 1,
      forks: 0,
      topics: "[]",
      last_pushed: "2026-01-01T00:00:00Z",
      visible: 1,
      screenshot_path: null,
      ingested_at: "2026-01-01T00:00:00Z",
    });
    db.setVisibility(project.slug, false);
    db.setScreenshot(project.slug, "data/test-persistence/screenshots/owner-repo.png");
    const { id: _ignoredId, ...projectData } = project;

    const refreshed = db.upsertProject({
      ...projectData,
      description: "After refresh",
      stars: 2,
      visible: 1,
      screenshot_path: null,
      ingested_at: "2026-01-02T00:00:00Z",
    });

    expect(refreshed.visible).toBe(0);
    expect(refreshed.screenshot_path).toContain("owner-repo.png");
    expect(refreshed.description).toBe("After refresh");
    db.close();
  });
});
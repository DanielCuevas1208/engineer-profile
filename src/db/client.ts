import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { ChangelogEntry, ProjectRecord } from "../types.js";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  url TEXT NOT NULL,
  homepage TEXT,
  language TEXT,
  stars INTEGER DEFAULT 0,
  forks INTEGER DEFAULT 0,
  topics TEXT DEFAULT '[]',
  last_pushed TEXT,
  visible INTEGER DEFAULT 1,
  screenshot_path TEXT,
  ingested_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS commits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  sha TEXT NOT NULL,
  message TEXT NOT NULL,
  author_name TEXT,
  author_email TEXT,
  committed_at TEXT NOT NULL,
  url TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id),
  UNIQUE(project_id, sha)
);

CREATE TABLE IF NOT EXISTS changelog (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  version TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  source TEXT NOT NULL,
  source_url TEXT,
  published_at TEXT NOT NULL,
  commit_shas TEXT DEFAULT '[]',
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE TABLE IF NOT EXISTS ingest_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT NOT NULL,
  detail TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_commits_project ON commits(project_id);
CREATE INDEX IF NOT EXISTS idx_changelog_project ON changelog(project_id);
`;

export class PortfolioDatabase {
  private db: Database.Database;

  constructor(
    dbPath: string,
    private readonly clock: () => string = () => new Date().toISOString()
  ) {
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.db.exec(SCHEMA);
    this.ensureColumn("changelog", "source_url", "TEXT");
  }

  private ensureColumn(table: string, column: string, definition: string): void {
    const columns = this.db.pragma(`table_info(${table})`) as Array<{ name: string }>;
    if (!columns.some((item) => item.name === column)) {
      this.db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
  }

  logIngest(action: string, detail?: string): void {
    this.db
      .prepare("INSERT INTO ingest_log (action, detail, created_at) VALUES (?, ?, ?)")
      .run(action, detail ?? null, this.clock());
  }

  upsertProject(project: Omit<ProjectRecord, "id">): ProjectRecord {
    const existing = this.getProjectBySlug(project.slug);

    if (existing) {
      this.db
        .prepare(
          `UPDATE projects SET
            name = ?, description = ?, url = ?, homepage = ?,
            language = ?, stars = ?, forks = ?, topics = ?,
            last_pushed = ?,
            visible = CASE WHEN ? = 0 THEN 0 ELSE visible END,
            screenshot_path = COALESCE(?, screenshot_path), ingested_at = ?
          WHERE slug = ?`
        )
        .run(
          project.name,
          project.description,
          project.url,
          project.homepage,
          project.language,
          project.stars,
          project.forks,
          project.topics,
          project.last_pushed,
          project.visible,
          project.screenshot_path,
          project.ingested_at,
          project.slug
        );
      return this.getProjectBySlug(project.slug)!;
    }

    const result = this.db
      .prepare(
        `INSERT INTO projects
          (slug, name, description, url, homepage, language, stars, forks,
           topics, last_pushed, visible, screenshot_path, ingested_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        project.slug,
        project.name,
        project.description,
        project.url,
        project.homepage,
        project.language,
        project.stars,
        project.forks,
        project.topics,
        project.last_pushed,
        project.visible,
        project.screenshot_path,
        project.ingested_at
      );

    return this.getProjectById(Number(result.lastInsertRowid))!;
  }

  upsertCommits(
    projectId: number,
    commits: Array<{
      sha: string;
      message: string;
      author_name: string | null;
      author_email: string | null;
      committed_at: string;
      url: string;
    }>
  ): number {
    const stmt = this.db.prepare(
      `INSERT OR IGNORE INTO commits
        (project_id, sha, message, author_name, author_email, committed_at, url)
      VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    let inserted = 0;
    const insertMany = this.db.transaction((rows) => {
      for (const commit of rows) {
        const result = stmt.run(
          projectId,
          commit.sha,
          commit.message,
          commit.author_name,
          commit.author_email,
          commit.committed_at,
          commit.url
        );
        if (result.changes > 0) inserted++;
      }
    });
    insertMany(commits);
    return inserted;
  }

  replaceChangelog(
    projectId: number,
    entries: Array<{
      version: string;
      title: string;
      body: string;
      source: string;
      source_url?: string | null;
      published_at: string;
      commit_shas: string;
    }>
  ): void {
    const del = this.db.prepare("DELETE FROM changelog WHERE project_id = ?");
    const ins = this.db.prepare(
      `INSERT INTO changelog
        (project_id, version, title, body, source, source_url, published_at, commit_shas)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const tx = this.db.transaction((rows) => {
      del.run(projectId);
      for (const entry of rows) {
        ins.run(
          projectId,
          entry.version,
          entry.title,
          entry.body,
          entry.source,
          entry.source_url ?? null,
          entry.published_at,
          entry.commit_shas
        );
      }
    });
    tx(entries);
  }

  setScreenshot(slug: string, screenshotPath: string): void {
    this.db
      .prepare("UPDATE projects SET screenshot_path = ? WHERE slug = ?")
      .run(screenshotPath, slug);
  }

  setVisibility(slug: string, visible: boolean): void {
    this.db
      .prepare("UPDATE projects SET visible = ? WHERE slug = ?")
      .run(visible ? 1 : 0, slug);
  }

  getProjectBySlug(slug: string): ProjectRecord | undefined {
    return this.db
      .prepare("SELECT * FROM projects WHERE slug = ?")
      .get(slug) as ProjectRecord | undefined;
  }

  getProjectById(id: number): ProjectRecord | undefined {
    return this.db
      .prepare("SELECT * FROM projects WHERE id = ?")
      .get(id) as ProjectRecord | undefined;
  }

  listProjects(visibleOnly = false): ProjectRecord[] {
    const query = visibleOnly
      ? "SELECT * FROM projects WHERE visible = 1 ORDER BY last_pushed DESC, slug ASC"
      : "SELECT * FROM projects ORDER BY last_pushed DESC, slug ASC";
    return this.db.prepare(query).all() as ProjectRecord[];
  }

  getChangelog(projectId: number): ChangelogEntry[] {
    return this.db
      .prepare(
        "SELECT * FROM changelog WHERE project_id = ? ORDER BY published_at DESC, id DESC"
      )
      .all(projectId) as ChangelogEntry[];
  }

  getCommits(projectId: number, limit = 50): Array<{
    sha: string;
    message: string;
    author_name: string | null;
    committed_at: string;
    url: string;
  }> {
    return this.db
      .prepare(
        "SELECT sha, message, author_name, committed_at, url FROM commits WHERE project_id = ? ORDER BY committed_at DESC, id DESC LIMIT ?"
      )
      .all(projectId, limit) as Array<{
      sha: string;
      message: string;
      author_name: string | null;
      committed_at: string;
      url: string;
    }>;
  }

  countCommits(projectId: number): number {
    const row = this.db
      .prepare("SELECT COUNT(*) AS count FROM commits WHERE project_id = ?")
      .get(projectId) as { count: number };
    return row.count;
  }

  countReleases(projectId: number): number {
    const row = this.db
      .prepare("SELECT COUNT(*) AS count FROM changelog WHERE project_id = ? AND source = 'release'")
      .get(projectId) as { count: number };
    return row.count;
  }

  getIngestLog(limit = 20): Array<{ action: string; detail: string | null; created_at: string }> {
    return this.db
      .prepare("SELECT action, detail, created_at FROM ingest_log ORDER BY id DESC LIMIT ?")
      .all(limit) as Array<{ action: string; detail: string | null; created_at: string }>;
  }

  close(): void {
    this.db.close();
  }
}

export function openDatabase(
  dataDir: string,
  clock: () => string = () => new Date().toISOString()
): PortfolioDatabase {
  return new PortfolioDatabase(`${dataDir}/portfolio.db`, clock);
}
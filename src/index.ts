#!/usr/bin/env node
import { Command } from "commander";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { ingestOwnerRepos, ingestRepository } from "./ingest/orchestrator.js";
import { captureAllProjects, captureLocalHtml, closeBrowser } from "./preview/capture.js";
import { copyScreenshotsToOutput, publishSite } from "./publish/site.js";
import { loadAllFixtures } from "./fixtures/loader.js";
import { openDatabase } from "./db/client.js";
import { DEFAULT_CONFIG, type PortfolioConfig } from "./types.js";

const program = new Command();

program
  .name("engineer-profile")
  .description("Build a local engineering portfolio from public repository evidence")
  .version("0.1.0");

function resolveConfig(options: { data?: string; output?: string }): PortfolioConfig {
  return {
    ...DEFAULT_CONFIG,
    dataDir: options.data ?? DEFAULT_CONFIG.dataDir,
    outputDir: options.output ?? DEFAULT_CONFIG.outputDir,
  };
}

program
  .command("demo")
  .description("Run the complete fixture pipeline without network access")
  .option("-d, --data <dir>", "Data directory", "data")
  .option("-o, --output <dir>", "Output directory", "output")
  .action(async (options) => {
    const config = resolveConfig(options);
    mkdirSync(config.dataDir, { recursive: true });
    mkdirSync(config.outputDir, { recursive: true });
    const fixtures = loadAllFixtures();
    const results = await ingestOwnerRepos(config, config.owner, fixtures.length, fixtures);
    console.log(`Ingested ${results.length} fixture projects.`);

    try {
      for (const fixture of fixtures) {
        const slug = fixture.repo.full_name.replace(/\//g, "-").toLowerCase();
        const fixturePage = join("fixtures", "preview-pages", `${fixture.repo.name}.html`);
        try {
          await captureLocalHtml(config, slug, fixturePage);
          console.log(`Captured ${slug}.`);
        } catch (error) {
          console.warn(`Skipped ${slug}: ${(error as Error).message}`);
        }
      }
    } finally {
      await closeBrowser();
    }

    const result = publishSite(config);
    const copied = copyScreenshotsToOutput(config);
    console.log(`Published ${result.projectCount} projects to ${result.indexPath}.`);
    console.log(`Copied ${copied} available preview screenshots.`);
    console.log("Open output/index.html in a browser.");
  });

program
  .command("ingest")
  .description("Ingest public GitHub repositories")
  .argument("<owner>", "GitHub owner or organization")
  .option("-r, --repo <name>", "Single repository name")
  .option("-l, --limit <n>", "Maximum repositories", "5")
  .option("-d, --data <dir>", "Data directory", "data")
  .option("--fixture", "Use local fixtures instead of the GitHub API")
  .action(async (owner, options) => {
    const config = resolveConfig(options);
    mkdirSync(config.dataDir, { recursive: true });
    if (options.fixture) {
      const results = await ingestOwnerRepos(config, owner, 5, loadAllFixtures());
      console.log(`Ingested ${results.length} fixture projects.`);
      return;
    }
    if (options.repo) {
      const result = await ingestRepository(config, { owner, repo: options.repo });
      console.log(`Ingested ${result.slug}: ${result.commitsAdded} new commits.`);
      return;
    }
    const results = await ingestOwnerRepos(config, owner, Number.parseInt(options.limit, 10));
    for (const result of results) console.log(`Ingested ${result.slug}: ${result.commitsAdded} new commits.`);
  });

program
  .command("capture")
  .description("Capture project preview screenshots with Playwright")
  .option("-d, --data <dir>", "Data directory", "data")
  .option("--fixture", "Capture local fixture pages")
  .action(async (options) => {
    const config = resolveConfig(options);
    if (options.fixture) {
      try {
        for (const fixture of loadAllFixtures()) {
          const slug = fixture.repo.full_name.replace(/\//g, "-").toLowerCase();
          await captureLocalHtml(config, slug, join("fixtures", "preview-pages", `${fixture.repo.name}.html`));
          console.log(`Captured ${slug}.`);
        }
      } finally {
        await closeBrowser();
      }
      return;
    }
    const paths = await captureAllProjects(config, (_slug, homepage, repoUrl) => homepage ?? repoUrl);
    console.log(`Captured ${paths.length} screenshots.`);
  });

program
  .command("publish")
  .description("Generate the static portfolio from SQLite")
  .option("-d, --data <dir>", "Data directory", "data")
  .option("-o, --output <dir>", "Output directory", "output")
  .action((options) => {
    const config = resolveConfig(options);
    const result = publishSite(config);
    const copied = copyScreenshotsToOutput(config);
    console.log(`Published ${result.projectCount} projects to ${result.indexPath}.`);
    console.log(`Copied ${copied} available preview screenshots.`);
  });

program
  .command("status")
  .description("Show project visibility and recent operations")
  .option("-d, --data <dir>", "Data directory", "data")
  .action((options) => {
    const config = resolveConfig(options);
    const db = openDatabase(config.dataDir, config.clock);
    try {
      const all = db.listProjects(false);
      const visible = db.listProjects(true);
      console.log(`Portfolio: ${config.title}`);
      console.log(`Projects: ${visible.length} visible, ${all.length - visible.length} hidden, ${all.length} total`);
      for (const project of all) {
        const state = project.visible ? "visible" : "hidden";
        console.log(`  ${project.slug} [${state}] - ${project.stars} stars - ${db.countCommits(project.id)} commits`);
      }
      const log = db.getIngestLog(5);
      if (log.length) {
        console.log("\nRecent operations:");
        for (const entry of log) console.log(`  ${entry.created_at.slice(0, 19)} - ${entry.action}: ${entry.detail ?? ""}`);
      }
    } finally {
      db.close();
    }
  });

program
  .command("privacy")
  .description("Hide or show a project in the published site")
  .option("--hide <slug>", "Hide a project")
  .option("--show <slug>", "Show a project")
  .option("-d, --data <dir>", "Data directory", "data")
  .action((options) => {
    const config = resolveConfig(options);
    const db = openDatabase(config.dataDir, config.clock);
    try {
      if (options.hide) {
        db.setVisibility(options.hide, false);
        console.log(`Hidden project: ${options.hide}`);
      }
      if (options.show) {
        db.setVisibility(options.show, true);
        console.log(`Showing project: ${options.show}`);
      }
    } finally {
      db.close();
    }
  });

await program.parseAsync();
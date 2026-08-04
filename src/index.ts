#!/usr/bin/env node
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { Command } from "commander";
import { ingestOwnerRepos, ingestRepository } from "./ingest/orchestrator.js";
import { captureAllProjects, captureLocalHtml, closeBrowser } from "./preview/capture.js";
import { copyScreenshotsToOutput, publishSite } from "./publish/site.js";
import { loadAllFixtures } from "./fixtures/loader.js";
import { openDatabase } from "./db/client.js";
import { DEFAULT_CONFIG, type PortfolioConfig } from "./types.js";
import { DEFAULT_CONFIG_PATH, loadPortfolioConfig } from "./config/loader.js";
import { refreshPortfolio } from "./refresh/run.js";
import { listBuiltinThemes } from "./theme/palette.js";
import { deployAll } from "./deploy/index.js";

const program = new Command();

program
  .name("engineer-profile")
  .description("Build a local engineering portfolio from public repository evidence")
  .version("0.3.0");

function resolveConfig(options: { config?: string; data?: string; output?: string }): PortfolioConfig {
  const base = options.config
    ? loadPortfolioConfig(options.config)
    : existsSync(DEFAULT_CONFIG_PATH)
      ? loadPortfolioConfig(DEFAULT_CONFIG_PATH)
      : DEFAULT_CONFIG;
  return {
    ...base,
    dataDir: options.data ?? base.dataDir,
    outputDir: options.output ?? base.outputDir,
  };
}

function addConfigOption(command: Command): Command {
  return command.option("-c, --config <file>", "Configuration file");
}

addConfigOption(program
  .command("demo")
  .description("Run the complete fixture pipeline without network access")
  .option("-d, --data <dir>", "Data directory")
  .option("-o, --output <dir>", "Output directory")
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
    for (const deployed of deployAll(config)) {
      console.log(`Deployed ${deployed.targetName}: ${deployed.files} files to ${deployed.targetPath}.`);
    }
    console.log("Open output/index.html in a browser.");
  }));

addConfigOption(program
  .command("ingest")
  .description("Ingest public GitHub repositories")
  .argument("[owner]", "GitHub owner or organization")
  .option("-r, --repo <name>", "Single repository name")
  .option("-l, --limit <n>", "Maximum repositories")
  .option("-d, --data <dir>", "Data directory")
  .option("--fixture", "Use local fixtures instead of the GitHub API")
  .action(async (owner, options) => {
    const config = resolveConfig(options);
    const targetOwner = owner ?? config.owner;
    const limit = Number.parseInt(options.limit ?? String(config.repositoryLimit ?? DEFAULT_CONFIG.repositoryLimit), 10);
    mkdirSync(config.dataDir, { recursive: true });
    if (options.fixture) {
      const results = await ingestOwnerRepos(config, targetOwner, limit, loadAllFixtures());
      console.log(`Ingested ${results.length} fixture projects.`);
      return;
    }
    if (options.repo) {
      const result = await ingestRepository(config, { owner: targetOwner, repo: options.repo });
      console.log(`Ingested ${result.slug}: ${result.commitsAdded} new commits.`);
      return;
    }
    const results = await ingestOwnerRepos(config, targetOwner, limit);
    for (const result of results) console.log(`Ingested ${result.slug}: ${result.commitsAdded} new commits.`);
  }));

addConfigOption(program
  .command("capture")
  .description("Capture project preview screenshots with Playwright")
  .option("-d, --data <dir>", "Data directory")
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
  }));

addConfigOption(program
  .command("publish")
  .description("Generate the static portfolio from SQLite")
  .option("-d, --data <dir>", "Data directory")
  .option("-o, --output <dir>", "Output directory")
  .action((options) => {
    const config = resolveConfig(options);
    const result = publishSite(config);
    const copied = copyScreenshotsToOutput(config);
    console.log(`Published ${result.projectCount} projects to ${result.indexPath}.`);
    console.log(`Copied ${copied} available preview screenshots.`);
  }));

addConfigOption(program
  .command("refresh")
  .description("Ingest, capture, publish, and deploy from the checked-in configuration")
  .option("-d, --data <dir>", "Data directory")
  .option("-o, --output <dir>", "Output directory")
  .action(async (options) => {
    const config = resolveConfig(options);
    mkdirSync(config.dataDir, { recursive: true });
    const result = await refreshPortfolio(config);
    console.log(`Ingested ${result.ingested} repositories for ${config.owner}.`);
    console.log(`Captured ${result.captured} project previews.`);
    console.log(`Published ${result.published.projectCount} projects to ${result.published.indexPath}.`);
    console.log(`Copied ${result.copiedScreenshots} available preview screenshots.`);
    for (const error of result.captureErrors) {
      console.warn(`Skipped ${error.slug}: ${error.message}`);
    }
    for (const deployed of result.deployed) {
      console.log(`Deployed ${deployed.targetName}: ${deployed.files} files to ${deployed.targetPath}.`);
    }
  }));

program
  .command("themes")
  .description("List built-in presentation themes")
  .action(() => {
    const themes = listBuiltinThemes();
    console.log(`Built-in themes: ${themes.length}`);
    for (const theme of themes) {
      console.log(`  ${theme.name}: ${theme.description}`);
    }
  });

addConfigOption(program
  .command("deploy")
  .description("Publish the snapshot and copy it to configured deploy targets")
  .option("-d, --data <dir>", "Data directory")
  .option("-o, --output <dir>", "Output directory")
  .action((options) => {
    const config = resolveConfig(options);
    mkdirSync(config.dataDir, { recursive: true });
    const result = publishSite(config);
    const copied = copyScreenshotsToOutput(config);
    console.log(`Published ${result.projectCount} projects to ${result.indexPath}.`);
    console.log(`Copied ${copied} available preview screenshots.`);
    const deployed = deployAll(config);
    if (deployed.length === 0) {
      console.log('No deploy targets configured. Add a "deploy.targets" entry to the configuration.');
    }
    for (const item of deployed) {
      console.log(`Deployed ${item.targetName}: ${item.files} files to ${item.targetPath}.`);
    }
  }));

addConfigOption(program
  .command("status")
  .description("Show project visibility and recent operations")
  .option("-d, --data <dir>", "Data directory")
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
  }));

addConfigOption(program
  .command("privacy")
  .description("Hide or show a project in the published site")
  .option("--hide <slug>", "Hide a project")
  .option("--show <slug>", "Show a project")
  .option("-d, --data <dir>", "Data directory")
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
  }));

await program.parseAsync();

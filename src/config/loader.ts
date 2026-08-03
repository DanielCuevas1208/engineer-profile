import { readFileSync } from "node:fs";
import type { PortfolioConfig, PrivacyConfig } from "../types.js";
import { DEFAULT_CONFIG, DEFAULT_DEPLOY, DEFAULT_PRIVACY } from "../types.js";
import { mergePrivacy } from "../privacy/controls.js";
import { isKnownTheme } from "../theme/registry.js";
import { isKnownAdapter } from "../deploy/adapters.js";

export const DEFAULT_CONFIG_PATH = "engineer-profile.config.json";

type ConfigValue = Record<string, unknown>;

function isConfigValue(value: unknown): value is ConfigValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(source: ConfigValue, key: string, fallback: string): string {
  if (!(key in source)) return fallback;
  const value = source[key];
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Configuration field "${key}" must be a non-empty string.`);
  }
  return value.trim();
}

function readTheme(source: ConfigValue): string {
  if (!("theme" in source)) return DEFAULT_CONFIG.theme;
  const value = source.theme;
  if (typeof value !== "string" || !isKnownTheme(value)) {
    throw new Error(
      `Configuration field "theme" must be one of: aurora, paper, terminal.`
    );
  }
  return value;
}

function readDeploy(source: ConfigValue): typeof DEFAULT_DEPLOY {
  if (!("deploy" in source)) return DEFAULT_DEPLOY;
  if (!isConfigValue(source.deploy)) {
    throw new Error('Configuration field "deploy" must be an object.');
  }

  const { adapter, targetDir } = source.deploy;
  let resolvedAdapter = DEFAULT_DEPLOY.adapter;
  if (adapter !== undefined) {
    if (typeof adapter !== "string" || !isKnownAdapter(adapter)) {
      throw new Error(
        'Configuration field "deploy.adapter" must be one of: local, none.'
      );
    }
    resolvedAdapter = adapter as typeof DEFAULT_DEPLOY.adapter;
  }

  let resolvedTarget: string | undefined;
  if (targetDir !== undefined) {
    if (typeof targetDir !== "string" || targetDir.trim() === "") {
      throw new Error('Configuration field "deploy.targetDir" must be a non-empty string.');
    }
    resolvedTarget = targetDir.trim();
  }

  return { adapter: resolvedAdapter, targetDir: resolvedTarget };
}

function readLimit(source: ConfigValue, key: string, fallback: number): number {
  if (!(key in source)) return fallback;
  const value = source[key];
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 100) {
    throw new Error(`Configuration field "${key}" must be an integer from 1 to 100.`);
  }
  return value;
}

function readPrivacy(source: ConfigValue): PrivacyConfig {
  if (!("privacy" in source)) return DEFAULT_PRIVACY;
  if (!isConfigValue(source.privacy)) {
    throw new Error('Configuration field "privacy" must be an object.');
  }

  const { hiddenProjects, redactEmails, maxCommitsPerProject } = source.privacy;
  if (hiddenProjects !== undefined &&
      (!Array.isArray(hiddenProjects) || hiddenProjects.some((slug) => typeof slug !== "string"))) {
    throw new Error('Configuration field "privacy.hiddenProjects" must be a list of strings.');
  }
  if (redactEmails !== undefined && typeof redactEmails !== "boolean") {
    throw new Error('Configuration field "privacy.redactEmails" must be a boolean.');
  }

  if (maxCommitsPerProject !== undefined &&
      (typeof maxCommitsPerProject !== "number" || !Number.isInteger(maxCommitsPerProject) || maxCommitsPerProject < 1)) {
    throw new Error('Configuration field "privacy.maxCommitsPerProject" must be a positive integer.');
  }

  return mergePrivacy(DEFAULT_PRIVACY, {
    hiddenProjects: hiddenProjects as string[] | undefined,
    redactEmails,
    maxCommitsPerProject: maxCommitsPerProject as number | undefined,
  });
}

export function loadPortfolioConfig(
  path: string = DEFAULT_CONFIG_PATH,
  clock: () => string = DEFAULT_CONFIG.clock
): PortfolioConfig {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, "utf-8")) as unknown;
  } catch (error) {
    throw new Error(`Could not read configuration file "${path}": ${(error as Error).message}`);
  }
  if (!isConfigValue(parsed)) {
    throw new Error(`Configuration file "${path}" must contain a JSON object.`);
  }

  return {
    ...DEFAULT_CONFIG,
    owner: readString(parsed, "owner", DEFAULT_CONFIG.owner),
    title: readString(parsed, "title", DEFAULT_CONFIG.title),
    tagline: readString(parsed, "tagline", DEFAULT_CONFIG.tagline),
    repositoryLimit: readLimit(parsed, "repositoryLimit", DEFAULT_CONFIG.repositoryLimit),
    dataDir: readString(parsed, "dataDir", DEFAULT_CONFIG.dataDir),
    outputDir: readString(parsed, "outputDir", DEFAULT_CONFIG.outputDir),
    theme: readTheme(parsed),
    deploy: readDeploy(parsed),
    privacy: readPrivacy(parsed),
    clock,
  };
}

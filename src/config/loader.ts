import { readFileSync } from "node:fs";
import type { DeploymentConfig, PortfolioConfig, PrivacyConfig } from "../types.js";
import { DEFAULT_CONFIG, DEFAULT_DEPLOY, DEFAULT_PRIVACY } from "../types.js";
import { mergePrivacy } from "../privacy/controls.js";
import { isKnownAdapter, listAdapters } from "../deploy/adapters.js";
import { isKnownTheme, listThemeNames } from "../theme/registry.js";

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

function readLimit(source: ConfigValue, key: string, fallback: number): number {
  if (!(key in source)) return fallback;
  const value = source[key];
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 100) {
    throw new Error(`Configuration field "${key}" must be an integer from 1 to 100.`);
  }
  return value;
}

function readTheme(source: ConfigValue, fallback: string): string {
  if (!("theme" in source)) return fallback;
  const value = source.theme;
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error('Configuration field "theme" must be a non-empty string.');
  }
  const name = value.trim();
  if (!isKnownTheme(name)) {
    throw new Error(`Configuration field "theme" must be one of: ${listThemeNames().join(", ")}.`);
  }
  return name;
}

function readDeploy(source: ConfigValue): DeploymentConfig {
  if (!("deploy" in source)) return DEFAULT_DEPLOY;
  if (!isConfigValue(source.deploy)) {
    throw new Error('Configuration field "deploy" must be an object.');
  }

  const { adapter, targetDir } = source.deploy;
  if (typeof adapter !== "string" || !isKnownAdapter(adapter)) {
    throw new Error(`Configuration field "deploy.adapter" must be one of: ${listAdapters().join(", ")}.`);
  }
  if (targetDir !== undefined && (typeof targetDir !== "string" || targetDir.trim() === "")) {
    throw new Error('Configuration field "deploy.targetDir" must be a non-empty string.');
  }

  return {
    adapter: adapter as DeploymentConfig["adapter"],
    targetDir: targetDir === undefined ? undefined : targetDir.trim(),
  };
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
    theme: readTheme(parsed, DEFAULT_CONFIG.theme),
    deploy: readDeploy(parsed),
    privacy: readPrivacy(parsed),
    clock,
  };
}

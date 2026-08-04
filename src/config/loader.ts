import { readFileSync } from "node:fs";
import type { DeployConfig, PortfolioConfig, PrivacyConfig, ThemeConfig } from "../types.js";
import { DEFAULT_CONFIG, DEFAULT_DEPLOY, DEFAULT_PRIVACY, DEFAULT_THEME } from "../types.js";
import { mergePrivacy } from "../privacy/controls.js";
import { isBuiltinTheme, isValidHexColor } from "../theme/palette.js";

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

function readTheme(source: ConfigValue): ThemeConfig {
  if (!("theme" in source)) return DEFAULT_THEME;
  if (!isConfigValue(source.theme)) {
    throw new Error('Configuration field "theme" must be an object.');
  }

  const { name, accent, radius, font } = source.theme;
  const theme: ThemeConfig = {};

  if (name !== undefined) {
    if (typeof name !== "string" || !isBuiltinTheme(name)) {
      throw new Error('Configuration field "theme.name" must be a built-in theme name.');
    }
    theme.name = name;
  }
  if (accent !== undefined) {
    if (typeof accent !== "string" || !isValidHexColor(accent)) {
      throw new Error('Configuration field "theme.accent" must be a hex color.');
    }
    theme.accent = accent;
  }
  if (radius !== undefined) {
    if (typeof radius !== "string" || radius.trim() === "") {
      throw new Error('Configuration field "theme.radius" must be a non-empty string.');
    }
    theme.radius = radius;
  }
  if (font !== undefined) {
    if (typeof font !== "string" || font.trim() === "") {
      throw new Error('Configuration field "theme.font" must be a non-empty string.');
    }
    theme.font = font;
  }

  return { ...DEFAULT_THEME, ...theme };
}

function readDeploy(source: ConfigValue): DeployConfig {
  if (!("deploy" in source)) return DEFAULT_DEPLOY;
  if (!isConfigValue(source.deploy)) {
    throw new Error('Configuration field "deploy" must be an object.');
  }

  const { targets } = source.deploy;
  if (targets === undefined) return DEFAULT_DEPLOY;
  if (!Array.isArray(targets)) {
    throw new Error('Configuration field "deploy.targets" must be a list.');
  }

  const parsed = targets.map((entry, index) => {
    if (!isConfigValue(entry)) {
      throw new Error(`Deploy target ${index} must be an object.`);
    }
    if (typeof entry.name !== "string" || entry.name.trim() === "") {
      throw new Error(`Deploy target ${index} must have a non-empty "name".`);
    }
    if (entry.type !== "local") {
      throw new Error(`Deploy target "${entry.name}" uses an unknown adapter type.`);
    }
    if (typeof entry.target !== "string" || entry.target.trim() === "") {
      throw new Error(`Deploy target "${entry.name}" must have a non-empty "target" path.`);
    }
    return {
      name: entry.name.trim(),
      type: "local" as const,
      target: entry.target.trim(),
    };
  });

  return { targets: parsed };
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

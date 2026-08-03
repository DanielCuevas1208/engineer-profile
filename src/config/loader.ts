import { readFileSync } from "node:fs";
import type {
  DeploymentConfig,
  DeploymentPlatform,
  FeedConfig,
  PortfolioConfig,
  PrivacyConfig,
  ThemeConfig,
} from "../types.js";
import {
  DEFAULT_CONFIG,
  DEFAULT_DEPLOYMENT,
  DEFAULT_FEED,
  DEFAULT_PRIVACY,
  DEFAULT_THEME,
} from "../types.js";
import { mergePrivacy } from "../privacy/controls.js";
import { isBuiltInTheme } from "../theme/resolve.js";

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

const CNAME_PATTERN =
  /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/i;

function readTheme(source: ConfigValue): ThemeConfig {
  if (!("theme" in source)) return DEFAULT_THEME;

  if (typeof source.theme === "string") {
    const name = source.theme.trim();
    if (!name) {
      throw new Error('Configuration field "theme" must be a non-empty theme name.');
    }
    if (!isBuiltInTheme(name)) {
      throw new Error(
        `Configuration field "theme" names an unknown theme "${name}". Add a custom CSS file or use a built-in theme.`
      );
    }
    return { name, customCss: null };
  }

  if (!isConfigValue(source.theme)) {
    throw new Error('Configuration field "theme" must be a theme name or an object.');
  }

  const { name, customCss } = source.theme;
  if (typeof name !== "string" || name.trim() === "") {
    throw new Error('Configuration field "theme.name" must be a non-empty string.');
  }
  if (customCss !== undefined &&
      (typeof customCss !== "string" || customCss.trim() === "")) {
    throw new Error('Configuration field "theme.customCss" must be a non-empty file path.');
  }
  if (!isBuiltInTheme(name.trim()) && customCss === undefined) {
    throw new Error(
      `Configuration field "theme.name" names an unknown theme "${name}". Add a custom CSS file or use a built-in theme.`
    );
  }

  return { name: name.trim(), customCss: typeof customCss === "string" ? customCss.trim() : null };
}

function readDeployment(source: ConfigValue): DeploymentConfig {
  if (!("deployment" in source)) return DEFAULT_DEPLOYMENT;
  if (!isConfigValue(source.deployment)) {
    throw new Error('Configuration field "deployment" must be an object.');
  }

  const { platform, cname } = source.deployment;
  let resolvedPlatform: DeploymentPlatform = DEFAULT_DEPLOYMENT.platform;
  if (platform !== undefined) {
    if (platform !== "none" && platform !== "github-pages") {
      throw new Error('Configuration field "deployment.platform" must be "none" or "github-pages".');
    }
    resolvedPlatform = platform;
  }

  let resolvedCname: string | null = DEFAULT_DEPLOYMENT.cname;
  if (cname !== undefined && cname !== null) {
    if (typeof cname !== "string" || cname.trim() === "") {
      throw new Error('Configuration field "deployment.cname" must be a domain name.');
    }
    const domain = cname.trim();
    if (!CNAME_PATTERN.test(domain)) {
      throw new Error(
        `Configuration field "deployment.cname" has an invalid domain name "${domain}".`
      );
    }
    resolvedCname = domain;
  }

  return { platform: resolvedPlatform, cname: resolvedCname };
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function readFeed(source: ConfigValue): FeedConfig {
  if (!("feed" in source)) return DEFAULT_FEED;
  if (!isConfigValue(source.feed)) {
    throw new Error('Configuration field "feed" must be an object.');
  }

  const { enabled, limit, description, siteUrl } = source.feed;

  let resolvedEnabled = DEFAULT_FEED.enabled;
  if (enabled !== undefined) {
    if (typeof enabled !== "boolean") {
      throw new Error('Configuration field "feed.enabled" must be a boolean.');
    }
    resolvedEnabled = enabled;
  }

  let resolvedLimit = DEFAULT_FEED.limit;
  if (limit !== undefined) {
    if (typeof limit !== "number" || !Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new Error('Configuration field "feed.limit" must be an integer from 1 to 100.');
    }
    resolvedLimit = limit;
  }

  let resolvedDescription: string | null = DEFAULT_FEED.description;
  if (description !== undefined) {
    if (typeof description !== "string" || description.trim() === "") {
      throw new Error('Configuration field "feed.description" must be a non-empty string.');
    }
    resolvedDescription = description.trim();
  }

  let resolvedSiteUrl: string | null = DEFAULT_FEED.siteUrl;
  if (siteUrl !== undefined && siteUrl !== null) {
    if (typeof siteUrl !== "string" || !isHttpUrl(siteUrl)) {
      throw new Error('Configuration field "feed.siteUrl" must be an absolute http or https URL.');
    }
    resolvedSiteUrl = siteUrl.trim();
  }

  return {
    enabled: resolvedEnabled,
    limit: resolvedLimit,
    description: resolvedDescription,
    siteUrl: resolvedSiteUrl,
  };
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
    privacy: readPrivacy(parsed),
    theme: readTheme(parsed),
    deployment: readDeployment(parsed),
    feed: readFeed(parsed),
    clock,
  };
}

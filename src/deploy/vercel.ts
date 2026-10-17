import { cpSync, existsSync, mkdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { openDatabase } from "../db/client.js";
import type { PortfolioConfig, VercelDeployTarget } from "../types.js";
import type { DeployResult } from "./local.js";
import type { DeployPreview } from "./preview.js";
import { compareSnapshots, digestSnapshot, listSnapshotPaths } from "./snapshot.js";

export interface VercelHeaderRule {
  source: string;
  headers: Array<{ key: string; value: string }>;
}

export interface VercelConfig {
  version: 2;
  cleanUrls?: boolean;
  trailingSlash?: boolean;
  headers?: VercelHeaderRule[];
}

export function generateVercelConfig(target?: VercelDeployTarget): VercelConfig {
  const headers: VercelHeaderRule[] = [
    {
      source: "/(.*)",
      headers: [
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      ],
    },
    {
      source: "/assets/(.*)",
      headers: [
        { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
      ],
    },
    {
      source: "/(.*).html",
      headers: [
        { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
      ],
    },
    {
      source: "/feed.xml",
      headers: [
        { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
        { key: "Content-Type", value: "application/rss+xml; charset=utf-8" },
      ],
    },
    {
      source: "/site-manifest.json",
      headers: [
        { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
        { key: "Content-Type", value: "application/json; charset=utf-8" },
      ],
    },
  ];

  return {
    version: 2,
    cleanUrls: target?.cleanUrls ?? true,
    trailingSlash: target?.trailingSlash ?? false,
    headers,
  };
}

export function buildVercelUri(target: VercelDeployTarget): string {
  if (target.projectId) {
    return `vercel://${target.projectId}`;
  }
  return `vercel://${target.name}`;
}

export function resolveVercelStagingDirectory(config: PortfolioConfig, target: VercelDeployTarget): string {
  return target.target ?? join("deploy", target.name);
}

function isPathInside(parent: string, child: string): boolean {
  const rel = relative(parent, child);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

export function previewVercel(config: PortfolioConfig, target: VercelDeployTarget): DeployPreview {
  const outputRoot = resolve(config.outputDir);
  const stagingPath = resolveVercelStagingDirectory(config, target);
  const stagingRoot = resolve(stagingPath);

  if (!existsSync(join(outputRoot, "index.html"))) {
    throw new Error(`No published site found at "${config.outputDir}". Run publish first.`);
  }
  if (isPathInside(outputRoot, stagingRoot)) {
    throw new Error(
      `Deploy target "${target.name}" staging directory must be outside the output directory "${config.outputDir}".`
    );
  }
  if (existsSync(stagingRoot) && !statSync(stagingRoot).isDirectory()) {
    throw new Error(`Deploy target "${target.name}" is not a directory: "${stagingPath}".`);
  }

  const rawDiff = compareSnapshots(outputRoot, stagingRoot);
  const removed = rawDiff.removed.filter((p) => p !== "vercel.json");
  const status = rawDiff.added.length || rawDiff.changed.length || removed.length ? "changed" : "clean";
  const targetUri = buildVercelUri(target);

  return {
    targetName: target.name,
    targetPath: targetUri,
    ...rawDiff,
    removed,
    status,
  };
}

export function deployVercel(config: PortfolioConfig, target: VercelDeployTarget): DeployResult {
  const outputRoot = resolve(config.outputDir);
  const stagingPath = resolveVercelStagingDirectory(config, target);
  const stagingRoot = resolve(stagingPath);

  if (!existsSync(join(outputRoot, "index.html"))) {
    throw new Error(`No published site found at "${config.outputDir}". Run publish first.`);
  }
  if (isPathInside(outputRoot, stagingRoot)) {
    throw new Error(
      `Deploy target "${target.name}" staging directory must be outside the output directory "${config.outputDir}".`
    );
  }

  mkdirSync(stagingRoot, { recursive: true });

  const outputFiles = listSnapshotPaths(outputRoot);
  const existingFiles = listSnapshotPaths(stagingRoot);

  let removed = 0;
  for (const rel of existingFiles) {
    if (outputFiles.includes(rel) || rel === "vercel.json") continue;
    rmSync(join(stagingRoot, rel), { force: true });
    removed++;
  }

  cpSync(outputRoot, stagingRoot, { recursive: true, force: true });

  const vercelConfig = generateVercelConfig(target);
  writeFileSync(
    join(stagingRoot, "vercel.json"),
    JSON.stringify(vercelConfig, null, 2),
    "utf-8"
  );

  const files = listSnapshotPaths(stagingRoot).filter((p) => p !== "vercel.json").length;
  const hasRequiredFiles =
    existsSync(join(stagingRoot, "index.html")) &&
    existsSync(join(stagingRoot, "site-manifest.json")) &&
    existsSync(join(stagingRoot, "vercel.json"));
  const sourceDigest = digestSnapshot(outputRoot);
  const targetDigest = digestSnapshot(stagingRoot);
  const verified = hasRequiredFiles && sourceDigest !== null;
  const targetUri = buildVercelUri(target);

  const db = openDatabase(config.dataDir, config.clock);
  try {
    const detail = `${target.name} -> ${targetUri} (${files} files, ${verified ? "verified" : "unverified"})`;
    db.logIngest("deploy", detail);
  } finally {
    db.close();
  }

  return {
    targetName: target.name,
    targetPath: targetUri,
    files,
    removed,
    verified,
    sourceDigest,
    targetDigest: sourceDigest,
  };
}

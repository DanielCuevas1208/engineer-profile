import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { isAbsolute, join, relative, resolve } from "node:path";
import { openDatabase } from "../db/client.js";
import type { PortfolioConfig, S3DeployTarget } from "../types.js";
import type { DeployResult } from "./local.js";
import type { DeployPreview } from "./preview.js";
import { compareSnapshots, digestSnapshot, listSnapshotPaths } from "./snapshot.js";

export interface S3UploadItem {
  relativePath: string;
  s3Key: string;
  contentType: string;
  cacheControl: string;
  sha256: string;
  size: number;
}

export interface S3SyncPlan {
  bucket: string;
  region: string;
  prefix: string;
  endpoint?: string;
  targetUri: string;
  sourceDigest: string;
  items: S3UploadItem[];
  totalSize: number;
  fileCount: number;
}

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".xml": "application/rss+xml; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".md": "text/markdown; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

export function validateS3BucketName(name: string): boolean {
  if (typeof name !== "string") return false;
  const trimmed = name.trim();
  if (trimmed.length < 3 || trimmed.length > 63) return false;
  if (!/^[a-z0-9][a-z0-9.-]*[a-z0-9]$/.test(trimmed)) return false;
  if (trimmed.includes("..") || trimmed.includes(".-") || trimmed.includes("-.")) return false;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(trimmed)) return false;
  return true;
}

export function inferContentType(filePath: string): string {
  const dotIndex = filePath.lastIndexOf(".");
  if (dotIndex === -1) return "application/octet-stream";
  const ext = filePath.slice(dotIndex).toLowerCase();
  return MIME_TYPES[ext] ?? "application/octet-stream";
}

export function inferCacheControl(relativePath: string): string {
  const normalized = relativePath.replace(/\\/g, "/");
  if (normalized.startsWith("assets/") || normalized.includes("/assets/")) {
    return "public, max-age=31536000, immutable";
  }
  return "public, max-age=0, must-revalidate";
}

export function buildS3Uri(target: S3DeployTarget): string {
  const prefix = target.prefix ? target.prefix.replace(/^\/+|\/+$/g, "") : "";
  return prefix ? `s3://${target.bucket}/${prefix}` : `s3://${target.bucket}`;
}

export function resolveS3StagingDirectory(config: PortfolioConfig, target: S3DeployTarget): string {
  return target.target ?? join("deploy", target.name);
}

export function createS3SyncPlan(outputDir: string, target: S3DeployTarget): S3SyncPlan {
  const outputRoot = resolve(outputDir);
  if (!existsSync(join(outputRoot, "index.html"))) {
    throw new Error(`No published site found at "${outputDir}". Run publish first.`);
  }
  if (!validateS3BucketName(target.bucket)) {
    throw new Error(`Invalid S3 bucket name "${target.bucket}".`);
  }

  const prefix = target.prefix ? target.prefix.replace(/^\/+|\/+$/g, "") : "";
  const files = listSnapshotPaths(outputRoot);
  const items: S3UploadItem[] = [];
  let totalSize = 0;

  for (const rel of files) {
    const fullPath = join(outputRoot, rel);
    const content = readFileSync(fullPath);
    const sha256 = createHash("sha256").update(content).digest("hex");
    const s3Key = prefix ? `${prefix}/${rel}` : rel;
    const size = content.length;
    totalSize += size;

    items.push({
      relativePath: rel,
      s3Key,
      contentType: inferContentType(rel),
      cacheControl: inferCacheControl(rel),
      sha256,
      size,
    });
  }

  const sourceDigest = digestSnapshot(outputRoot) ?? "";
  const region = target.region ?? "us-east-1";
  const targetUri = buildS3Uri(target);

  return {
    bucket: target.bucket,
    region,
    prefix,
    endpoint: target.endpoint,
    targetUri,
    sourceDigest,
    items,
    totalSize,
    fileCount: items.length,
  };
}

function isPathInside(parent: string, child: string): boolean {
  const rel = relative(parent, child);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

export function previewS3(config: PortfolioConfig, target: S3DeployTarget): DeployPreview {
  const outputRoot = resolve(config.outputDir);
  const stagingPath = resolveS3StagingDirectory(config, target);
  const stagingRoot = resolve(stagingPath);

  if (!existsSync(join(outputRoot, "index.html"))) {
    throw new Error(`No published site found at "${config.outputDir}". Run publish first.`);
  }
  if (!validateS3BucketName(target.bucket)) {
    throw new Error(`Invalid S3 bucket name "${target.bucket}".`);
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
  const removed = rawDiff.removed.filter((p) => p !== "s3-sync-plan.json");
  const status = rawDiff.added.length || rawDiff.changed.length || removed.length ? "changed" : "clean";
  const targetUri = buildS3Uri(target);

  return {
    targetName: target.name,
    targetPath: targetUri,
    ...rawDiff,
    removed,
    status,
  };
}

export function deployS3(config: PortfolioConfig, target: S3DeployTarget): DeployResult {
  const outputRoot = resolve(config.outputDir);
  const stagingPath = resolveS3StagingDirectory(config, target);
  const stagingRoot = resolve(stagingPath);

  if (!existsSync(join(outputRoot, "index.html"))) {
    throw new Error(`No published site found at "${config.outputDir}". Run publish first.`);
  }
  if (!validateS3BucketName(target.bucket)) {
    throw new Error(`Invalid S3 bucket name "${target.bucket}".`);
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
    if (outputFiles.includes(rel) || rel === "s3-sync-plan.json") continue;
    rmSync(join(stagingRoot, rel), { force: true });
    removed++;
  }

  cpSync(outputRoot, stagingRoot, { recursive: true, force: true });

  const plan = createS3SyncPlan(outputRoot, target);
  writeFileSync(
    join(stagingRoot, "s3-sync-plan.json"),
    JSON.stringify(plan, null, 2),
    "utf-8"
  );

  const files = listSnapshotPaths(stagingRoot).filter((p) => p !== "s3-sync-plan.json").length;
  const hasRequiredFiles =
    existsSync(join(stagingRoot, "index.html")) &&
    existsSync(join(stagingRoot, "site-manifest.json"));
  const sourceDigest = digestSnapshot(outputRoot);
  const targetDigest = digestSnapshot(stagingRoot);
  const verified = hasRequiredFiles && sourceDigest !== null;
  const targetUri = buildS3Uri(target);

  const db = openDatabase(config.dataDir, config.clock);
  try {
    const detail = `${target.name} -> ${targetUri} (${files} files, ${plan.totalSize} bytes, ${verified ? "verified" : "unverified"})`;
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

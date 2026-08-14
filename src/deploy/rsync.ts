import { cpSync, existsSync, mkdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { openDatabase } from "../db/client.js";
import type { PortfolioConfig, RsyncDeployTarget } from "../types.js";
import type { DeployResult } from "./local.js";
import type { DeployPreview } from "./preview.js";
import { compareSnapshots, digestSnapshot, listSnapshotPaths } from "./snapshot.js";

export interface RsyncCommandPlan {
  command: string;
  args: string[];
  remoteDestination: string;
  sourceDir: string;
  flags: string[];
  targetUri: string;
}

export function buildRsyncUri(target: RsyncDeployTarget): string {
  const userPrefix = target.user ? `${target.user}@` : "";
  const portSuffix = target.port ? `:${target.port}` : "";
  return `rsync://${userPrefix}${target.host}${portSuffix}/${target.path.replace(/^\/+/, "")}`;
}

export function buildRemoteRsyncDestination(target: RsyncDeployTarget): string {
  const userPrefix = target.user ? `${target.user}@` : "";
  return `${userPrefix}${target.host}:${target.path}`;
}

export function createRsyncPlan(sourceDir: string, target: RsyncDeployTarget): RsyncCommandPlan {
  const sourceNormalized = sourceDir.replace(/\\/g, "/").replace(/\/+$/, "") + "/";
  const remoteDestination = buildRemoteRsyncDestination(target);
  const flags = ["-avz", "--checksum"];

  if (target.delete !== false) {
    flags.push("--delete");
  }

  const args = [...flags];
  if (target.port) {
    args.push("-e", `ssh -p ${target.port}`);
  }
  args.push(sourceNormalized, remoteDestination);

  const command = `rsync ${args.join(" ")}`;
  const targetUri = buildRsyncUri(target);

  return {
    command,
    args,
    remoteDestination,
    sourceDir: sourceNormalized,
    flags,
    targetUri,
  };
}

export function resolveRsyncStagingDirectory(config: PortfolioConfig, target: RsyncDeployTarget): string {
  return target.target ?? join("deploy", target.name);
}

function isPathInside(parent: string, child: string): boolean {
  const rel = relative(parent, child);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

export function previewRsync(config: PortfolioConfig, target: RsyncDeployTarget): DeployPreview {
  const outputRoot = resolve(config.outputDir);
  const stagingPath = resolveRsyncStagingDirectory(config, target);
  const stagingRoot = resolve(stagingPath);

  if (!existsSync(join(outputRoot, "index.html"))) {
    throw new Error(`No published site found at "${config.outputDir}". Run publish first.`);
  }
  if (!target.host || target.host.trim() === "") {
    throw new Error(`Rsync deploy target "${target.name}" must specify a host.`);
  }
  if (!target.path || target.path.trim() === "") {
    throw new Error(`Rsync deploy target "${target.name}" must specify a remote path.`);
  }
  if (target.port !== undefined && (!Number.isInteger(target.port) || target.port < 1 || target.port > 65535)) {
    throw new Error(`Rsync deploy target "${target.name}" port must be an integer from 1 to 65535.`);
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
  const removed = rawDiff.removed.filter((p) => p !== "rsync-plan.json");
  const status = rawDiff.added.length || rawDiff.changed.length || removed.length ? "changed" : "clean";
  const targetUri = buildRsyncUri(target);

  return {
    targetName: target.name,
    targetPath: targetUri,
    ...rawDiff,
    removed,
    status,
  };
}

export function deployRsync(config: PortfolioConfig, target: RsyncDeployTarget): DeployResult {
  const outputRoot = resolve(config.outputDir);
  const stagingPath = resolveRsyncStagingDirectory(config, target);
  const stagingRoot = resolve(stagingPath);

  if (!existsSync(join(outputRoot, "index.html"))) {
    throw new Error(`No published site found at "${config.outputDir}". Run publish first.`);
  }
  if (!target.host || target.host.trim() === "") {
    throw new Error(`Rsync deploy target "${target.name}" must specify a host.`);
  }
  if (!target.path || target.path.trim() === "") {
    throw new Error(`Rsync deploy target "${target.name}" must specify a remote path.`);
  }
  if (target.port !== undefined && (!Number.isInteger(target.port) || target.port < 1 || target.port > 65535)) {
    throw new Error(`Rsync deploy target "${target.name}" port must be an integer from 1 to 65535.`);
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
    if (outputFiles.includes(rel) || rel === "rsync-plan.json") continue;
    rmSync(join(stagingRoot, rel), { force: true });
    removed++;
  }

  cpSync(outputRoot, stagingRoot, { recursive: true, force: true });

  const plan = createRsyncPlan(stagingRoot, target);
  writeFileSync(
    join(stagingRoot, "rsync-plan.json"),
    JSON.stringify(plan, null, 2),
    "utf-8"
  );

  const files = listSnapshotPaths(stagingRoot).filter((p) => p !== "rsync-plan.json").length;
  const hasRequiredFiles =
    existsSync(join(stagingRoot, "index.html")) &&
    existsSync(join(stagingRoot, "site-manifest.json"));
  const sourceDigest = digestSnapshot(outputRoot);
  const targetDigest = digestSnapshot(stagingRoot);
  const verified = hasRequiredFiles && sourceDigest !== null;
  const targetUri = buildRsyncUri(target);

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

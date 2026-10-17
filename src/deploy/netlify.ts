import { cpSync, existsSync, mkdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { openDatabase } from "../db/client.js";
import type { NetlifyDeployTarget, NetlifyHeaderRule, NetlifyRedirectRule, PortfolioConfig } from "../types.js";
import type { DeployResult } from "./local.js";
import type { DeployPreview } from "./preview.js";
import { compareSnapshots, digestSnapshot, listSnapshotPaths } from "./snapshot.js";

const DEFAULT_SECURITY_HEADERS: Record<string, string> = {
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

export function generateNetlifyHeaders(target?: NetlifyDeployTarget): string {
  const blocks: string[] = [];

  // Root security headers
  const rootHeaders: Record<string, string> = { ...DEFAULT_SECURITY_HEADERS };
  if (target?.headers) {
    const rootRule = target.headers.find((r) => r.for === "/*" || r.for === "/*");
    if (rootRule) {
      Object.assign(rootHeaders, rootRule.values);
    }
  }

  blocks.push("/*");
  for (const [key, value] of Object.entries(rootHeaders)) {
    blocks.push(`  ${key}: ${value}`);
  }

  // Static assets caching headers
  blocks.push("/assets/*");
  blocks.push("  Cache-Control: public, max-age=31536000, immutable");

  // Dynamic / HTML caching headers
  blocks.push("/*.html");
  blocks.push("  Cache-Control: public, max-age=0, must-revalidate");

  blocks.push("/feed.xml");
  blocks.push("  Cache-Control: public, max-age=0, must-revalidate");
  blocks.push("  Content-Type: application/rss+xml; charset=utf-8");

  blocks.push("/site-manifest.json");
  blocks.push("  Cache-Control: public, max-age=0, must-revalidate");
  blocks.push("  Content-Type: application/json; charset=utf-8");

  // Custom user rules
  if (target?.headers) {
    for (const rule of target.headers) {
      if (rule.for === "/*") continue;
      blocks.push(rule.for);
      for (const [key, value] of Object.entries(rule.values)) {
        blocks.push(`  ${key}: ${value}`);
      }
    }
  }

  return blocks.join("\n") + "\n";
}

export function generateNetlifyRedirects(redirects?: NetlifyRedirectRule[]): string {
  if (!redirects || redirects.length === 0) return "";
  const lines: string[] = [];
  for (const rule of redirects) {
    const status = rule.status ?? 301;
    const force = rule.force ? "!" : "";
    lines.push(`${rule.from}  ${rule.to}  ${status}${force}`);
  }
  return lines.join("\n") + "\n";
}

export function buildNetlifyUri(target: NetlifyDeployTarget): string {
  if (target.siteId) {
    return `netlify://${target.siteId}`;
  }
  return `netlify://${target.name}`;
}

export function resolveNetlifyStagingDirectory(config: PortfolioConfig, target: NetlifyDeployTarget): string {
  return target.target ?? join("deploy", target.name);
}

function isPathInside(parent: string, child: string): boolean {
  const rel = relative(parent, child);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

export function previewNetlify(config: PortfolioConfig, target: NetlifyDeployTarget): DeployPreview {
  const outputRoot = resolve(config.outputDir);
  const stagingPath = resolveNetlifyStagingDirectory(config, target);
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
  const removed = rawDiff.removed.filter((p) => p !== "_headers" && p !== "_redirects");
  const status = rawDiff.added.length || rawDiff.changed.length || removed.length ? "changed" : "clean";
  const targetUri = buildNetlifyUri(target);

  return {
    targetName: target.name,
    targetPath: targetUri,
    ...rawDiff,
    removed,
    status,
  };
}

export function deployNetlify(config: PortfolioConfig, target: NetlifyDeployTarget): DeployResult {
  const outputRoot = resolve(config.outputDir);
  const stagingPath = resolveNetlifyStagingDirectory(config, target);
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
    if (outputFiles.includes(rel) || rel === "_headers" || rel === "_redirects") continue;
    rmSync(join(stagingRoot, rel), { force: true });
    removed++;
  }

  cpSync(outputRoot, stagingRoot, { recursive: true, force: true });

  // Write _headers
  const headersContent = generateNetlifyHeaders(target);
  writeFileSync(join(stagingRoot, "_headers"), headersContent, "utf-8");

  // Write _redirects if configured
  if (target.redirects && target.redirects.length > 0) {
    const redirectsContent = generateNetlifyRedirects(target.redirects);
    writeFileSync(join(stagingRoot, "_redirects"), redirectsContent, "utf-8");
  }

  const files = listSnapshotPaths(stagingRoot).filter((p) => p !== "_headers" && p !== "_redirects").length;
  const hasRequiredFiles =
    existsSync(join(stagingRoot, "index.html")) &&
    existsSync(join(stagingRoot, "site-manifest.json")) &&
    existsSync(join(stagingRoot, "_headers"));
  const sourceDigest = digestSnapshot(outputRoot);
  const targetDigest = digestSnapshot(stagingRoot);
  const verified = hasRequiredFiles && sourceDigest !== null;
  const targetUri = buildNetlifyUri(target);

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

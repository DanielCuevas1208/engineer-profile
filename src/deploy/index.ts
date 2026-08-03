import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { openDatabase } from "../db/client.js";
import type { PortfolioConfig } from "../types.js";

export interface DeployFile {
  path: string;
  content: string;
}

export interface DeployAdapter {
  name: string;
  label: string;
  files: (domain: string | undefined) => DeployFile[];
}

export interface DeployResult {
  adapter: string;
  domain?: string;
  files: string[];
}

const GITHUB_PAGES: DeployAdapter = {
  name: "gh-pages",
  label: "GitHub Pages",
  files: (domain) => {
    const files: DeployFile[] = [{ path: ".nojekyll", content: "" }];
    if (domain) files.push({ path: "CNAME", content: `${domain}\n` });
    return files;
  },
};

const VERCEL: DeployAdapter = {
  name: "vercel",
  label: "Vercel",
  files: () => [
    {
      path: "vercel.json",
      content: `${JSON.stringify(
        {
          cleanUrls: true,
          headers: [
            {
              source: "/assets/screenshots/(.*)",
              headers: [
                {
                  key: "Cache-Control",
                  value: "public, max-age=31536000, immutable",
                },
              ],
            },
          ],
        },
        null,
        2
      )}\n`,
    },
  ],
};

const NETLIFY: DeployAdapter = {
  name: "netlify",
  label: "Netlify",
  files: () => [
    {
      path: "netlify.toml",
      content: `[build]
publish = "."

[[headers]]
  for = "/assets/screenshots/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"
`,
    },
  ],
};

const SURGE: DeployAdapter = {
  name: "surge",
  label: "Surge",
  files: (domain) => {
    if (!domain) return [];
    return [{ path: "CNAME", content: `${domain}\n` }];
  },
};

const NONE: DeployAdapter = {
  name: "none",
  label: "Local files only",
  files: () => [],
};

export const DEPLOY_ADAPTERS: DeployAdapter[] = [
  GITHUB_PAGES,
  VERCEL,
  NETLIFY,
  SURGE,
  NONE,
];

export function listDeployAdapters(): DeployAdapter[] {
  return DEPLOY_ADAPTERS.map((adapter) => ({ ...adapter, files: adapter.files }));
}

export function resolveAdapter(name: string): DeployAdapter {
  const adapter = DEPLOY_ADAPTERS.find((candidate) => candidate.name === name);
  if (!adapter) {
    const names = DEPLOY_ADAPTERS.map((candidate) => candidate.name).join(", ");
    throw new Error(`Unknown deployment adapter "${name}". Available adapters: ${names}.`);
  }
  return adapter;
}

export function applyDeployAdapter(
  config: PortfolioConfig,
  adapterOverride?: string,
  domainOverride?: string
): DeployResult {
  const adapterName = adapterOverride ?? config.deploy.adapter;
  const domain = domainOverride ?? config.deploy.domain;
  const adapter = resolveAdapter(adapterName);
  const files = adapter.files(domain);

  mkdirSync(config.outputDir, { recursive: true });
  for (const file of files) {
    writeFileSync(join(config.outputDir, file.path), file.content, "utf-8");
  }

  if (adapterName !== "none") {
    const db = openDatabase(config.dataDir, config.clock);
    try {
      db.logIngest("deploy", `${adapterName}${domain ? ` -> ${domain}` : ""}`);
    } finally {
      db.close();
    }
  }

  return {
    adapter: adapterName,
    domain,
    files: files.map((file) => file.path),
  };
}

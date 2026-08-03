import type { DeploymentConfig } from "../types.js";

export interface DeployFile {
  path: string;
  contents: string;
}

export interface DeployPlan {
  adapterId: string;
  label: string;
  files: DeployFile[];
  instructions: string[];
}

export interface DeployAdapter {
  id: string;
  label: string;
  files: (deploy: DeploymentConfig) => DeployFile[];
  instructions: (deploy: DeploymentConfig) => string[];
}

function domainFromSiteUrl(siteUrl: string | undefined): string | undefined {
  if (!siteUrl) return undefined;
  try {
    const url = new URL(siteUrl);
    return url.host || undefined;
  } catch {
    return undefined;
  }
}

const SCREENSHOT_CACHE =
  "public, max-age=31536000, immutable";

const githubPages: DeployAdapter = {
  id: "github-pages",
  label: "GitHub Pages",
  files: (deploy) => {
    const files: DeployFile[] = [{ path: ".nojekyll", contents: "" }];
    const domain = domainFromSiteUrl(deploy.siteUrl);
    if (domain) files.push({ path: "CNAME", contents: `${domain}\n` });
    return files;
  },
  instructions: () => [
    "Push the output directory to the branch that serves GitHub Pages.",
    "Enable Pages from the settings page of that branch.",
  ],
};

const netlify: DeployAdapter = {
  id: "netlify",
  label: "Netlify",
  files: () => [
    {
      path: "netlify.toml",
      contents: [
        "[build]",
        '  publish = "."',
        "",
        "[[headers]]",
        '  for = "/assets/screenshots/*"',
        "  [headers.values]",
        `    Cache-Control = "${SCREENSHOT_CACHE}"`,
        "",
      ].join("\n"),
    },
  ],
  instructions: () => [
    "Link the output directory as the publish directory in Netlify.",
    "Deploy with the Netlify CLI or a connected repository.",
  ],
};

const vercel: DeployAdapter = {
  id: "vercel",
  label: "Vercel",
  files: () => [
    {
      path: "vercel.json",
      contents: [
        "{",
        '  "cleanUrls": true,',
        '  "headers": [',
        "    {",
        '      "source": "/assets/screenshots/(.*)",',
        '      "headers": [',
        "        {",
        '          "key": "Cache-Control",',
        `          "value": "${SCREENSHOT_CACHE}"`,
        "        }",
        "      ]",
        "    }",
        "  ]",
        "}",
        "",
      ].join("\n"),
    },
  ],
  instructions: () => [
    "Set the output directory as the Vercel project root.",
    "Deploy with the Vercel CLI or a connected repository.",
  ],
};

const ADAPTERS: Record<string, DeployAdapter> = {
  [githubPages.id]: githubPages,
  [netlify.id]: netlify,
  [vercel.id]: vercel,
};

export function isValidAdapterId(id: string): boolean {
  return Object.prototype.hasOwnProperty.call(ADAPTERS, id);
}

export function deployAdapterIds(): string[] {
  return Object.keys(ADAPTERS);
}

export function getAdapter(id: string): DeployAdapter {
  const adapter = ADAPTERS[id];
  if (!adapter) {
    throw new Error(
      `Unknown deployment adapter "${id}". Use one of: ${deployAdapterIds().join(", ")}.`
    );
  }
  return adapter;
}

export function buildDeployPlan(
  adapterId: string,
  deploy: DeploymentConfig
): DeployPlan {
  const adapter = getAdapter(adapterId);
  return {
    adapterId: adapter.id,
    label: adapter.label,
    files: adapter.files(deploy),
    instructions: adapter.instructions(deploy),
  };
}

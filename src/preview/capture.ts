import { chromium, type Browser } from "playwright";
import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { openDatabase } from "../db/client.js";
import type { PortfolioConfig } from "../types.js";

export interface CaptureOptions {
  slug: string;
  url: string;
  width?: number;
  height?: number;
}

let sharedBrowser: Browser | null = null;

export async function getBrowser(): Promise<Browser> {
  if (!sharedBrowser) sharedBrowser = await chromium.launch({ headless: true });
  return sharedBrowser;
}

export async function closeBrowser(): Promise<void> {
  if (sharedBrowser) {
    await sharedBrowser.close();
    sharedBrowser = null;
  }
}

export async function captureScreenshot(
  config: PortfolioConfig,
  options: CaptureOptions
): Promise<string> {
  const screenshotsDir = join(config.dataDir, "screenshots");
  mkdirSync(screenshotsDir, { recursive: true });

  const outputPath = resolve(screenshotsDir, `${options.slug}.png`);
  const browser = await getBrowser();
  const page = await browser.newPage({
    viewport: {
      width: options.width ?? 1280,
      height: options.height ?? 720,
    },
    deviceScaleFactor: 1,
  });

  try {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(options.url, { waitUntil: "networkidle", timeout: 30_000 });
    await page.screenshot({ path: outputPath, fullPage: false });
  } finally {
    await page.close();
  }

  const db = openDatabase(config.dataDir, config.clock);
  try {
    db.setScreenshot(options.slug, outputPath);
    db.logIngest("capture", `${options.slug} -> ${outputPath}`);
  } finally {
    db.close();
  }

  return outputPath;
}

export async function captureLocalHtml(
  config: PortfolioConfig,
  slug: string,
  htmlPath: string
): Promise<string> {
  const fileUrl = `file:///${resolve(htmlPath).replace(/\\/g, "/")}`;
  return captureScreenshot(config, { slug, url: fileUrl });
}

export async function captureAllProjects(
  config: PortfolioConfig,
  urlResolver: (slug: string, homepage: string | null, repoUrl: string) => string | null
): Promise<string[]> {
  const db = openDatabase(config.dataDir, config.clock);
  const captured: string[] = [];
  try {
    for (const project of db.listProjects(true)) {
      const target = urlResolver(project.slug, project.homepage, project.url);
      if (!target) continue;
      captured.push(await captureScreenshot(config, { slug: project.slug, url: target }));
    }
  } finally {
    db.close();
    await closeBrowser();
  }
  return captured;
}
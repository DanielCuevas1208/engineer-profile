import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import {
  buildRemoteRsyncDestination,
  buildRsyncUri,
  createRsyncPlan,
  deployRsync,
  previewRsync,
  type RsyncCommandPlan,
} from "../src/deploy/rsync.js";
import { ingestOwnerRepos } from "../src/ingest/orchestrator.js";
import { publishSite } from "../src/publish/site.js";
import { loadAllFixtures } from "../src/fixtures/loader.js";
import { DEFAULT_CONFIG, type PortfolioConfig, type RsyncDeployTarget } from "../src/types.js";

const TEST_DATA = join("data", "test-rsync-deploy");
const TEST_OUTPUT = join("output", "test-rsync-deploy");
const TEST_STAGING = join("deploy", "test-rsync-staging");

describe("Rsync URI and command planning", () => {
  it("formats rsync URIs correctly", () => {
    const target: RsyncDeployTarget = {
      name: "ssh-host",
      type: "rsync",
      host: "server.example.com",
      user: "deployer",
      path: "/var/www/portfolio",
      port: 2222,
    };
    expect(buildRsyncUri(target)).toBe("rsync://deployer@server.example.com:2222/var/www/portfolio");
    expect(buildRemoteRsyncDestination(target)).toBe("deployer@server.example.com:/var/www/portfolio");
  });

  it("builds deterministic rsync command plan", () => {
    const target: RsyncDeployTarget = {
      name: "ssh-host",
      type: "rsync",
      host: "server.example.com",
      user: "deployer",
      path: "/var/www/portfolio",
      port: 2222,
      delete: true,
    };

    const plan = createRsyncPlan("output", target);
    expect(plan.command).toContain("rsync -avz --checksum --delete -e ssh -p 2222 output/ deployer@server.example.com:/var/www/portfolio");
    expect(plan.flags).toContain("-avz");
    expect(plan.flags).toContain("--checksum");
    expect(plan.flags).toContain("--delete");
  });
});

describe("Rsync deploy pipeline", () => {
  beforeEach(async () => {
    rmSync(TEST_DATA, { recursive: true, force: true });
    rmSync(TEST_OUTPUT, { recursive: true, force: true });
    rmSync(TEST_STAGING, { recursive: true, force: true });

    const config: PortfolioConfig = {
      ...DEFAULT_CONFIG,
      dataDir: TEST_DATA,
      outputDir: TEST_OUTPUT,
      clock: () => "2026-08-01T00:00:00.000Z",
    };
    await ingestOwnerRepos(config, config.owner, 2, loadAllFixtures());
    publishSite(config);
  });

  afterEach(() => {
    rmSync(TEST_DATA, { recursive: true, force: true });
    rmSync(TEST_OUTPUT, { recursive: true, force: true });
    rmSync(TEST_STAGING, { recursive: true, force: true });
  });

  it("previews Rsync staging differences", () => {
    const config: PortfolioConfig = {
      ...DEFAULT_CONFIG,
      dataDir: TEST_DATA,
      outputDir: TEST_OUTPUT,
      clock: () => "2026-08-01T00:00:00.000Z",
    };
    const target: RsyncDeployTarget = {
      name: "preview-rsync",
      type: "rsync",
      host: "rsync.example.com",
      path: "/var/www/html",
      target: TEST_STAGING,
    };

    const preview = previewRsync(config, target);
    expect(preview.targetName).toBe("preview-rsync");
    expect(preview.targetPath).toBe("rsync://rsync.example.com/var/www/html");
    expect(preview.status).toBe("changed");
    expect(preview.added).toContain("index.html");
  });

  it("deploys Rsync bundle with rsync-plan.json", () => {
    const config: PortfolioConfig = {
      ...DEFAULT_CONFIG,
      dataDir: TEST_DATA,
      outputDir: TEST_OUTPUT,
      clock: () => "2026-08-01T00:00:00.000Z",
    };
    const target: RsyncDeployTarget = {
      name: "prod-rsync",
      type: "rsync",
      host: "rsync.example.com",
      user: "webmaster",
      path: "/srv/www/site",
      port: 2200,
      target: TEST_STAGING,
    };

    const result = deployRsync(config, target);
    expect(result.targetName).toBe("prod-rsync");
    expect(result.targetPath).toBe("rsync://webmaster@rsync.example.com:2200/srv/www/site");
    expect(result.verified).toBe(true);
    expect(result.files).toBeGreaterThan(0);

    const planPath = join(TEST_STAGING, "rsync-plan.json");
    expect(existsSync(planPath)).toBe(true);
    const plan = JSON.parse(readFileSync(planPath, "utf-8")) as RsyncCommandPlan;
    expect(plan.remoteDestination).toBe("webmaster@rsync.example.com:/srv/www/site");
    expect(plan.args).toContain("ssh -p 2200");
  });
});

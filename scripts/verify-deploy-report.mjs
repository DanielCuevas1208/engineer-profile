import { readFileSync } from "node:fs";

const reportPath = process.env.DEPLOY_REPORT ?? "deploy-preview.json";
const digestPattern = /^[a-f0-9]{64}$/;

function fail(message) {
  console.error("Verify failed: " + message);
  process.exit(1);
}

let report;
try {
  report = JSON.parse(readFileSync(reportPath, "utf-8").replace(/^\uFEFF/, ""));
} catch {
  fail("could not read " + reportPath);
}

if (report === null || typeof report !== "object" || Array.isArray(report)) {
  fail("report must be an object");
}

if (report.formatVersion !== 1) {
  fail("expected formatVersion 1, got " + report.formatVersion);
}
if (report.mode !== "preview" && report.mode !== "sync") {
  fail("unknown report mode " + report.mode);
}
if (typeof report.generatedAt !== "string" || report.generatedAt === "") {
  fail("generatedAt is missing");
}
if (typeof report.outputDir !== "string" || report.outputDir === "") {
  fail("outputDir is missing");
}
if (!Array.isArray(report.targets)) {
  fail("targets is missing");
}

for (const target of report.targets) {
  if (target === null || typeof target !== "object") {
    fail("target must be an object");
  }
  if (typeof target.targetName !== "string" || target.targetName === "") {
    fail("targetName is missing");
  }
  if (typeof target.targetPath !== "string" || target.targetPath === "") {
    fail("targetPath is missing for " + target.targetName);
  }
  if (!digestPattern.test(target.sourceDigest ?? "")) {
    fail("sourceDigest is invalid for " + target.targetName);
  }
  if (report.mode === "preview") {
    if (target.status !== "clean" && target.status !== "changed") {
      fail("status is invalid for " + target.targetName);
    }
    if (!Array.isArray(target.added) || !Array.isArray(target.changed) || !Array.isArray(target.removed)) {
      fail("file changes are missing for " + target.targetName);
    }
    if (target.targetDigest !== null && !digestPattern.test(target.targetDigest ?? "")) {
      fail("targetDigest is invalid for " + target.targetName);
    }
    if (target.status === "clean" && target.sourceDigest !== target.targetDigest) {
      fail("clean target digest does not match source for " + target.targetName);
    }
    continue;
  }
  if (!Number.isInteger(target.files) || target.files < 0) {
    fail("files is invalid for " + target.targetName);
  }
  if (!Number.isInteger(target.removed) || target.removed < 0) {
    fail("removed is invalid for " + target.targetName);
  }
  if (target.verified !== true) {
    fail("target is not verified for " + target.targetName);
  }
  if (!digestPattern.test(target.targetDigest ?? "")) {
    fail("targetDigest is invalid for " + target.targetName);
  }
  if (target.sourceDigest !== target.targetDigest) {
    fail("synced target digest does not match source for " + target.targetName);
  }
}

console.log("Deploy report ok: " + report.targets.length + " target(s), mode " + report.mode + ".");

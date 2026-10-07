const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const desktopDir = path.resolve(__dirname, "..");
const packageJson = JSON.parse(fs.readFileSync(path.join(desktopDir, "package.json"), "utf8"));

function gitValue(args, fallback) {
  try {
    return execFileSync("git", args, { cwd: desktopDir, encoding: "utf8" }).trim() || fallback;
  } catch (_) {
    return fallback;
  }
}

const commit = process.env.GITHUB_SHA || process.env.TRON_BUILD_COMMIT || gitValue(["rev-parse", "HEAD"], "local");
const dirty = process.env.GITHUB_ACTIONS === "true"
  ? false
  : Boolean(gitValue(["status", "--porcelain"], ""));
const buildInfo = {
  version: packageJson.version,
  commit: commit.slice(0, 40),
  dirty,
  builtAt: process.env.TRON_BUILD_DATE || new Date().toISOString(),
  releaseTag: process.env.GITHUB_REF_NAME || process.env.TRON_RELEASE_TAG || `v${packageJson.version}`,
};

fs.writeFileSync(
  path.join(desktopDir, "build-info.json"),
  `${JSON.stringify(buildInfo, null, 2)}\n`,
  "utf8",
);

console.log(`TRON build info: ${buildInfo.version} ${buildInfo.commit.slice(0, 7)}${buildInfo.dirty ? " (dirty)" : ""}`);

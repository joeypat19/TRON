const fs = require("node:fs");
const path = require("node:path");

const desktopDir = path.resolve(__dirname, "..");
const packageJson = JSON.parse(fs.readFileSync(path.join(desktopDir, "package.json"), "utf8"));
const expectedTag = `v${packageJson.version}`;
const actualTag = process.env.GITHUB_REF_NAME || process.env.TRON_RELEASE_TAG;

if (!actualTag) {
  console.error(`Release validation failed: expected tag ${expectedTag}. Set GITHUB_REF_NAME or TRON_RELEASE_TAG.`);
  process.exit(1);
}

if (actualTag !== expectedTag) {
  console.error(`Release validation failed: package version ${packageJson.version} does not match tag ${actualTag}.`);
  process.exit(1);
}

console.log(`Release validation passed: ${actualTag}`);

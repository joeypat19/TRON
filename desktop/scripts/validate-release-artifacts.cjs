const fs = require("node:fs");
const path = require("node:path");

const desktopDir = path.resolve(__dirname, "..");
const packageJson = JSON.parse(fs.readFileSync(path.join(desktopDir, "package.json"), "utf8"));
const version = packageJson.version;
const distDir = path.join(desktopDir, "dist");
const installerName = `TRON-${version}-Setup.exe`;
const blockmapName = `${installerName}.blockmap`;
const installerPath = path.join(distDir, installerName);
const blockmapPath = path.join(distDir, blockmapName);
const latestPath = path.join(distDir, "latest.yml");

function requireFile(filePath, label) {
  if (!fs.existsSync(filePath) || fs.statSync(filePath).size === 0) {
    throw new Error(`${label} is missing or empty: ${filePath}`);
  }
}

try {
  requireFile(installerPath, "installer");
  requireFile(blockmapPath, "blockmap");
  requireFile(latestPath, "update metadata");

  const latest = fs.readFileSync(latestPath, "utf8");
  if (!new RegExp(`^version: ${version.replaceAll(".", "\\.")}\\s*$`, "m").test(latest)) {
    throw new Error(`latest.yml does not declare version ${version}`);
  }
  if (!new RegExp(`^path: ${installerName.replace(".", "\\.")}\\s*$`, "m").test(latest)) {
    throw new Error(`latest.yml does not point to ${installerName}`);
  }
  if (!/^sha512:\s*\S+/m.test(latest)) {
    throw new Error("latest.yml is missing the installer sha512 value");
  }

  console.log(`Release artifacts passed: ${installerName}, latest.yml, ${blockmapName}`);
} catch (error) {
  console.error(`Release artifact validation failed: ${error.message}`);
  process.exit(1);
}

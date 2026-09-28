"use strict";
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");
const { checkEnvironment } = require("./check-env.cjs");
const root = path.resolve(__dirname, "..");
const stamp = path.join(root, ".cache", "dependencies.sha256");
function fingerprint() {
  return crypto.createHash("sha256")
    .update(fs.readFileSync(path.join(root, "package-lock.json")))
    .update(process.versions.node.split(".")[0])
    .update(process.platform).update(process.arch).digest("hex");
}

function installedTreeMatchesLock() {
  // Reuse the complete dependency tree supplied with this project when versions
  // match. This also avoids a needless network install after extracting a ZIP.
  try {
    const wanted = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8')).packages;
    const installed = JSON.parse(fs.readFileSync(path.join(root, 'node_modules', '.package-lock.json'), 'utf8')).packages;
    for (const [name, dependency] of Object.entries(wanted)) {
      if (!name) continue;
      const os = dependency.os || [];
      const cpu = dependency.cpu || [];
      const accepts = (rules, value) => !rules.includes('!' + value) &&
        (!rules.some(rule => !rule.startsWith('!')) || rules.includes(value));
      if (dependency.optional && (!accepts(os, process.platform) || !accepts(cpu, process.arch))) continue;
      const entry = installed[name];
      if (!entry || entry.version !== dependency.version) return false;
      if (dependency.integrity && entry.integrity !== dependency.integrity) return false;
      const metadata = JSON.parse(fs.readFileSync(path.join(root, name, 'package.json'), 'utf8'));
      if (metadata.version !== dependency.version) return false;
    }
    return true;
  } catch { return false; }
}

try {
  checkEnvironment();
  const expected = fingerprint();
  const haveStamp = fs.existsSync(stamp) && fs.readFileSync(stamp, "utf8").trim() === expected;
  const haveDependencies = ["hexo/bin/hexo", "hexo-server/package.json", "hexo-renderer-pug/package.json"]
    .every(name => fs.existsSync(path.join(root, "node_modules", name)));
  const canReuse = haveDependencies && (haveStamp || (!fs.existsSync(stamp) && installedTreeMatchesLock()));
  if (!process.argv.includes("--reinstall") && canReuse) {
    fs.mkdirSync(path.dirname(stamp), { recursive: true });
    fs.writeFileSync(stamp, expected + "\n");
    console.log("Dependencies are already installed for this lockfile and Node.js version.");
  } else {
    console.log("Installing this project's locked dependencies with npm ci...");
    console.log("Internet access to registry.npmjs.org is required. Source files will not be changed.");
    let result;
    const npmCli = process.env.npm_execpath;
    if (npmCli && fs.existsSync(npmCli) && /\.[cm]?js$/i.test(npmCli)) {
      result = spawnSync(process.execPath, [npmCli, "ci", "--registry=https://registry.npmjs.org"], { cwd: root, stdio: "inherit" });
    } else if (process.platform === "win32") {
      result = spawnSync(process.env.ComSpec || "cmd.exe", ["/d", "/c", "npm ci --registry=https://registry.npmjs.org"], { cwd: root, stdio: "inherit" });
    } else {
      result = spawnSync("npm", ["ci", "--registry=https://registry.npmjs.org"], { cwd: root, stdio: "inherit" });
    }
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error("Dependency installation failed. Read the npm error above; do not continue to preview.");
    fs.mkdirSync(path.dirname(stamp), { recursive: true });
    fs.writeFileSync(stamp, expected + "\n");
    console.log("Dependencies installed successfully.");
  }
} catch (error) {
  console.error("[ERROR] " + error.message);
  process.exitCode = 1;
}

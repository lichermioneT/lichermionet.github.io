"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { createRequire } = require("node:module");
const { checkEnvironment } = require("./check-env.cjs");
const root = path.resolve(__dirname, "..");
const cli = path.join(root, "node_modules", "hexo", "bin", "hexo");
if (!fs.existsSync(cli)) {
  console.error("[ERROR] Project dependencies are not installed.");
  console.error("Run: npm run setup   (or double-click 1_INSTALL_AND_CHECK.cmd)");
  process.exit(1);
}
process.chdir(root);
try {
  checkEnvironment();
  // Read using Hexo's own YAML dependency before the CLI parses any post dates.
  const hexoRequire = createRequire(path.join(root, "node_modules", "hexo", "package.json"));
  const config = hexoRequire("js-yaml").load(fs.readFileSync(path.join(root, "_config.yml"), "utf8"));
  if (config && typeof config.timezone === "string" && config.timezone.trim()) {
    process.env.TZ = config.timezone.trim();
  }
} catch (error) {
  console.error("[ERROR] " + error.message);
  console.error("Check _config.yml, Node.js, and project dependencies before continuing.");
  process.exit(1);
}
require(cli);

"use strict";
function checkEnvironment() {
  const [major, minor] = process.versions.node.split(".").map(Number);
  if (major < 20 || major >= 25 || (major === 20 && minor < 19)) {
    throw new Error(`Node.js ${process.versions.node} is outside this project's >=20.19 <25 range. Install Node.js 24, then reopen the terminal.`);
  }
}
if (require.main === module) {
  try { checkEnvironment(); console.log(`Node.js ${process.versions.node}: OK`); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { checkEnvironment };

import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const projectRoot = process.cwd();
const publicDir = path.join(projectRoot, "public");
const htmlFiles = [];

async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await walk(fullPath);
    } else if (entry.isFile() && entry.name.endsWith(".html")) {
      htmlFiles.push(fullPath);
    }
  }
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function decodeUrlPath(value) {
  const cleanValue = value.split("#", 1)[0].split("?", 1)[0];
  try {
    return decodeURIComponent(cleanValue);
  } catch {
    return cleanValue;
  }
}

function isIgnoredUrl(value) {
  return (
    !value ||
    value.startsWith("#") ||
    value.startsWith("//") ||
    /^(?:https?:|mailto:|tel:|javascript:|data:)/i.test(value)
  );
}

function candidatePaths(urlValue, htmlFile) {
  const urlPath = decodeUrlPath(urlValue).replaceAll("/", path.sep);
  const target = urlValue.startsWith("/")
    ? path.join(publicDir, urlPath.replace(/^[/\\]+/, ""))
    : path.resolve(path.dirname(htmlFile), urlPath);

  const relative = path.relative(publicDir, target);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return [];
  }

  if (urlValue.endsWith("/")) {
    return [path.join(target, "index.html")];
  }

  if (path.extname(target)) {
    return [target];
  }

  return [target, `${target}.html`, path.join(target, "index.html")];
}

await walk(publicDir);

const broken = new Map();
const attributePattern = /\b(?:href|src|data-lazy-src)=["']([^"'<>]+)["']/gi;

for (const htmlFile of htmlFiles) {
  const html = await readFile(htmlFile, "utf8");
  for (const match of html.matchAll(attributePattern)) {
    const urlValue = match[1].trim();
    if (isIgnoredUrl(urlValue)) continue;

    const candidates = candidatePaths(urlValue, htmlFile);
    if (candidates.length === 0) continue;

    const found = (await Promise.all(candidates.map(exists))).some(Boolean);
    if (!found) {
      const key = `${path.relative(publicDir, htmlFile)} -> ${urlValue}`;
      broken.set(key, true);
    }
  }
}

const homeHtml = await readFile(path.join(publicDir, "index.html"), "utf8");
const seoProblems = [];

if (!/<meta name="description" content="[^"]+"/i.test(homeHtml)) {
  seoProblems.push("首页缺少非空 meta description");
}

for (const placeholder of ["code-xxx", 'content="xxx"', "qrcode-weichat", "qrcode-alipay"]) {
  if (homeHtml.includes(placeholder)) {
    seoProblems.push(`首页仍包含主题示例内容：${placeholder}`);
  }
}

if (broken.size > 0 || seoProblems.length > 0) {
  console.error("站点检查失败：");
  for (const problem of seoProblems) console.error(`- ${problem}`);
  for (const item of broken.keys()) console.error(`- 内部资源不存在：${item}`);
  process.exitCode = 1;
} else {
  console.log(`站点检查通过：${htmlFiles.length} 个 HTML 页面，未发现坏内部链接或示例 SEO 内容。`);
}

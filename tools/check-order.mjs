import { readFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

const publicDir = path.resolve('public');
let manifest;
try {
  manifest = JSON.parse(await readFile(path.join(publicDir, 'post-order-manifest.json'), 'utf8'));
} catch (error) {
  console.error('缺少排序检查数据，请先运行 npm run build。');
  process.exit(1);
}
const problems = [];
let listPages = 0;
let navigationPages = 0;
const root = '/' + (manifest.root || '').replace(/^\/+|\/+$/g, '');
const prefix = root === '/' ? '' : root;
const expectedPath = value => normalizePath(prefix + '/' + value.replace(/^\/+/, ''));
function normalizePath(value) {
  let clean = value.replaceAll('&amp;', '&').split(/[?#]/, 1)[0];
  try { clean = decodeURIComponent(clean); } catch { /* keep malformed input for comparison */ }
  return clean.replace(/index\.html$/, '').replace(/\/$/, '');
}
function attr(tag, name) {
  return tag.match(new RegExp(`\\b${name}=["']([^"']*)["']`, 'i'))?.[1] || '';
}
function linksByClass(html, className) {
  return [...html.matchAll(/<a\b[^>]*>/gi)]
    .map(match => match[0])
    .filter(tag => attr(tag, 'class').split(/\s+/).includes(className))
    .map(tag => normalizePath(attr(tag, 'href')));
}
function htmlPath(route) {
  const clean = route.replace(/^\/+/, '');
  return path.join(publicDir, clean.endsWith('.html') ? clean : clean + '/index.html');
}
function mainPostList(html) {
  const start = html.search(/<div\b[^>]*\bid=["']recent-posts["']/i);
  if (start < 0) throw new Error('Main homepage list is missing.');
  const rest = html.slice(start);
  let depth = 0;
  for (const match of rest.matchAll(/<\/?div\b[^>]*>/gi)) {
    depth += /^<\//.test(match[0]) ? -1 : 1;
    if (depth === 0) return rest.slice(0, match.index + match[0].length);
  }
  throw new Error('Main homepage list is incomplete.');
}
async function checkList(route, posts, className) {
  try {
    const html = await readFile(htmlPath(route), 'utf8');
    const content = className === 'article-title' ? mainPostList(html) : html;
    assert.deepEqual(linksByClass(content, className), posts.map(post => expectedPath(post.path)));
    listPages += 1;
  } catch (error) {
    problems.push(`${route || '/'}：文章列表与 order/日期规则不一致，或页面缺失。${error.code || ''}`);
  }
}
function checkNumbers(name, posts) {
  const seen = new Set();
  let last = 0;
  for (const post of posts) {
    if (post.order === null) {
      console.warn(`[排序提醒] ${post.source} 未填写有效 order，将排在已编号文章后面。`);
      last = Number.MAX_SAFE_INTEGER;
      continue;
    }
    if (!Number.isSafeInteger(post.order) || post.order <= 0) problems.push(`${post.source}：order 不是正整数。`);
    if (seen.has(post.order)) problems.push(`${name}：order ${post.order} 重复，请为同一分类分配不同编号。`);
    if (post.order < last) problems.push(`${name}：排序后的编号没有递增。`);
    seen.add(post.order);
    last = post.order;
  }
}
async function checkPaged(base, posts, perPage, paginationDir, className) {
  const pageSize = perPage > 0 ? perPage : Math.max(posts.length, 1);
  const total = Math.max(1, Math.ceil(posts.length / pageSize));
  const start = base.replace(/\/$/, '');
  for (let i = 1; i <= total; i++) {
    const route = i === 1 ? start : `${start ? start + '/' : ''}${paginationDir}/${i}`;
    await checkList(route, posts.slice((i - 1) * pageSize, i * pageSize), className);
  }
}
for (const category of manifest.categories) {
  checkNumbers(category.name, category.posts);
  await checkPaged(category.path, category.posts, manifest.categoryPerPage, manifest.paginationDir, 'article-sort-item-title');
}
for (const column of manifest.columns) await checkList(column.path, column.posts, 'article-sort-item-title');
await checkPaged(manifest.indexPath, manifest.homepage, manifest.indexPerPage, manifest.indexPaginationDir, 'article-title');

for (const post of manifest.posts) {
  if (!post.enabled) continue;
  try {
    const html = await readFile(htmlPath(post.path), 'utf8');
    for (const direction of ['prev', 'next']) {
      const expression = new RegExp(`<div\\b[^>]*class=["'][^"']*\\b${direction}-post\\b[^"']*["'][^>]*>\\s*(<a\\b[^>]*>)`, 'i');
      const match = html.match(expression);
      const actual = match ? normalizePath(attr(match[1], 'href')) : null;
      const expected = post[direction] ? expectedPath(post[direction]) : null;
      assert.equal(actual, expected, `${post.source} ${direction}`);
    }
    navigationPages += 1;
  } catch (error) {
    problems.push(`${post.source}：上一篇/下一篇不是该分类的相邻章节，或页面缺失。`);
  }
}
if (problems.length) {
  console.error('文章排序检查失败：\n' + problems.map(item => '- ' + item).join('\n'));
  process.exitCode = 1;
} else {
  console.log(`文章排序检查通过：${manifest.posts.length} 篇文章，${listPages} 个列表页面（含后续分页），${navigationPages} 篇文章导航。`);
}

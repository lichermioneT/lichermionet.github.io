'use strict';

// The uploaded public/ still used this address. Keep it working without renaming
// the user's current Markdown file or changing its publication date.
const aliases = [
  { path: '2026/07/30/C语言常见概念/', source: '_posts/C语言1常见概念.md' }
];
function escapeHtml(value) {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}
hexo.extend.generator.register('legacy-post-links', function (locals) {
  return aliases.flatMap(alias => {
    const post = locals.posts.findOne({ source: alias.source });
    if (!post || post.path === alias.path) return [];
    const prefix = (hexo.config.root || '/').replace(/\/$/, '');
    const target = escapeHtml(encodeURI(prefix + '/' + post.path));
    const canonical = escapeHtml(post.permalink);
    return [{
      path: alias.path + 'index.html',
      data: `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="0;url=${target}"><link rel="canonical" href="${canonical}"><title>文章已更新</title></head><body><p>文章地址已更新，<a href="${target}">点击继续阅读</a>。</p></body></html>`
    }];
  });
});

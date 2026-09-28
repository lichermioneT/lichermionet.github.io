'use strict';

// 在生成页面前，读取文章的 order，生成用于排序的数值。
// order 使用正整数；未填写或填写无效时，排在已编号文章后面。
hexo.extend.filter.register('before_generate', function () {
  hexo.locals.get('posts').forEach(function (post) {
    const raw = post.order;
    const value = typeof raw === 'number'
      ? raw
      : (typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : NaN);

    post.manual_order = Number.isSafeInteger(value) && value > 0
      ? value
      : Number.MAX_SAFE_INTEGER;
  });
});

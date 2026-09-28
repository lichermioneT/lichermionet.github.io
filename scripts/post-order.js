"use strict";

const { SORT_FIELDS, normalizeOrder } = require("../tools/lib/post-order.cjs");

// Warehouse returns NEW Post documents for category.posts and other queries.
// Assigning post.manual_order on hexo.locals.get('posts') changes only that copy.
// A virtual getter is applied to EVERY Post document, including category queries,
// cached builds and live-preview rebuilds. It never rewrites a Markdown file.
hexo.model("Post").schema.virtual("manual_order").get(function () {
  return normalizeOrder(this.order);
});

function primaryCategory(post) {
  const category = post.categories.toArray()[0];
  return category ? category.name : "";
}

let navigation = null;
hexo.extend.filter.register("before_generate", function () {
  navigation = null;
});

function navigationFor(post) {
  if (hexo.config.post_order && hexo.config.post_order.navigation === false) return null;
  if (!navigation) {
    navigation = new Map();
    const groups = new Map();
    hexo.locals.get("posts").sort(SORT_FIELDS).forEach(item => {
      const name = primaryCategory(item);
      if (!groups.has(name)) groups.set(name, []);
      groups.get(name).push(item);
    });
    for (const [category, posts] of groups) {
      posts.forEach((item, i) => navigation.set(item.source, {
        category,
        prev: i > 0 ? posts[i - 1] : null,
        next: i + 1 < posts.length ? posts[i + 1] : null
      }));
    }
  }
  return navigation.get(post.source) || null;
}

hexo.extend.helper.register("ordered_post_navigation", navigationFor);

// This machine-readable output lets npm run check:order verify rendered HTML,
// including page 2+, rather than merely checking that YAML contains order fields.
hexo.extend.generator.register("post-order-manifest", function (locals) {
  const visible = new Set(locals.posts.map(post => post.source));
  const summary = post => ({
    source: post.source,
    title: post.title,
    path: post.path,
    order: normalizeOrder(post.order) === Number.MAX_SAFE_INTEGER ? null : normalizeOrder(post.order)
  });
  const categoryPosts = category => category.posts
    .filter(post => visible.has(post.source)).sort(SORT_FIELDS);
  const categories = locals.categories.map(category => ({
    name: category.name,
    path: category.path,
    posts: categoryPosts(category).map(summary)
  }));
  const columns = locals.pages.filter(page => page.layout === "column").map(page => {
    const category = locals.categories.findOne({ name: page.column });
    return {
      path: page.path,
      category: page.column,
      posts: category ? categoryPosts(category).map(summary) : []
    };
  });
  const homepage = locals.posts.sort(hexo.config.index_generator.order_by).toArray();
  homepage.sort((a, b) => (Number(b.sticky) || 0) - (Number(a.sticky) || 0));
  const postNavigation = locals.posts.map(post => {
    const nav = navigationFor(post);
    return {
      ...summary(post),
      enabled: Boolean(nav),
      prev: nav && nav.prev ? nav.prev.path : null,
      next: nav && nav.next ? nav.next.path : null
    };
  });
  const data = {
    categoryPerPage: hexo.config.category_generator.per_page,
    indexPerPage: hexo.config.index_generator.per_page,
    paginationDir: hexo.config.pagination_dir || "page",
    indexPath: hexo.config.index_generator.path || "",
    indexPaginationDir: hexo.config.index_generator.pagination_dir || hexo.config.pagination_dir || "page",
    root: hexo.config.root || "/",
    categories, columns, homepage: homepage.map(summary), posts: postNavigation
  };
  return { path: "post-order-manifest.json", data: JSON.stringify(data, null, 2) };
});

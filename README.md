# Lichermione 的技术博客

基于项目现有的 Hexo 7.3.0 与 AnZhiYu 主题；本次修复不升级依赖版本。

## 先打开哪一个文件？

请先看 **使用说明_先看这里.md**。各分类的具体编号见 **文章排序清单.md**。

## Windows 使用

建议沿用 Node.js 24（项目范围为 >=20.19 <25，与原部署配置一致）。

- `1_INSTALL_AND_CHECK.cmd`：检查/安装依赖，构建并检查站点。
- `2_PREVIEW.cmd`：检查/安装依赖，构建检查后启动本地预览。

先把压缩包完整解压，不要在压缩软件内部直接运行脚本。已有仓库时，把源码包里的文件合并覆盖到原仓库，保留原来的 `.git` 和 `node_modules`。

命令行方式，在有 `package.json` 的项目根目录执行：

```bash
npm run setup
npm run validate
npm run dev
```

浏览器访问 `http://localhost:4000`，按 Ctrl+C 停止预览。

## 文章排序

首页主文章列表按日期从新到旧；分类页、专栏页按 `order` 从小到大。文章底部的上一篇/下一篇也按同一分类的章节顺序，不跨分类跳转。

```yaml
---
title: 文章标题
date: 2026-09-28 10:00:00
categories:
  - Linux
order: 16
tags:
  - Linux
comments: false
---

正文……
```

不同分类可以重复编号；同一分类不要重复。只调整位置时修改 `order`，不要改日期或文件名。未填写或无效的编号排在已编号文章后面；并列时按日期、标题排序。

## 新文章与草稿

```bash
npm run new -- draft "新文章标题"
npm run draft
npm run publish -- "新文章标题"
```

正式文章位于 `source/_posts/`，草稿位于 `source/_drafts/`。新文章模板已添加 `order` 提醒。

## 检查与发布

```bash
npm run validate
git status
git add -A
git diff --cached
git commit -m "fix: 完善博客文章排序与本地预览"
git push
```

先确认暂存内容是准备发布的修改，再提交。脚本不会自动提交、推送或修改线上博客。已有仓库不需要重新 `git init`，不要强制推送。

原 `.github/workflows/pages.yml` 保留：推送到 `main` 后触发构建与 Pages 部署；是否成功以 Actions 结果为准。

## 常用命令

| 命令 | 用途 |
| --- | --- |
| `npm run setup` | 检查已有依赖；缺失或锁文件变化时安装 |
| `npm run setup -- --reinstall` | 根据锁文件重新安装依赖，不修改正文 |
| `npm run validate` | 构建、内部链接检查、真实 HTML 排序检查 |
| `npm run check:order` | 检查已有 public 页面中的列表与章节导航 |
| `npm run test:order` | 编号边界与 Warehouse 实际查询回归测试 |
| `npm run dev` | 启动正式文章预览 |
| `npm run draft` | 预览时包括草稿 |

## 技术说明

旧脚本只给某一次查询返回的文章对象赋值，分类页重新查询文章时读不到该值。现在给 Hexo 的 Post 模型注册 `manual_order` 虚拟 getter，每次查询都从原始 `order` 得到同一个数值，不改 Markdown 日期。

`tools/run-hexo.cjs` 直接调用项目内的 Hexo CLI，不依赖全局 Hexo 或 `.bin` 启动文件，并在读取文章前使用 `_config.yml` 的时区，避免纯日期字段在不同系统构建时偏移一天。

`public/post-order-manifest.json` 是构建生成的检查数据，不要手动编辑。`npm run validate` 会把这个数据与实际生成的 HTML 对照，包括第二页及后续分页。

图片仍可放在文章同名资源目录。不要引用电脑绝对路径或不存在的文件。原文中缺失图片的既有注释保留，本次没有编造或补绘图片。

不要提交 `node_modules/`、`public/`、`db.json` 或 `.cache/`，这些仍由 `.gitignore` 忽略。

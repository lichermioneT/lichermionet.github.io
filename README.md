# Lichermione 的技术博客

基于 Hexo 7 与 AnZhiYu 主题构建，发布地址为 <https://lichermionet.github.io>。

## 本地使用

环境要求：Node.js 20.19 以上、低于 25。首次使用或 `package-lock.json` 更新后安装依赖：

```powershell
cd D:\Desktop\lic
npm ci
```

本地预览：

```powershell
npm run dev
```

浏览器打开 <http://localhost:4000>。提交前运行完整检查：

```powershell
npm run validate
```

## 写一篇新博客

推荐先写草稿：

```powershell
npx hexo new draft "文章标题"
npm run draft
```

草稿位于 `source\_drafts\文章标题.md`。完成后发布为正式文章：

```powershell
npm run publish -- "文章标题"
```

也可以直接创建正式文章：

```powershell
npm run new -- "文章标题"
```

每篇文章的开头使用以下信息：

```yaml
---
title: 文章标题
date: 2026-07-29 20:00:00
updated: 2026-07-29 20:00:00
description: 用一句话概括文章内容
categories:
  - Linux
tags:
  - Linux
  - 进程
comments: false
---
```

## 添加文章图片

项目已经启用文章资源文件夹。创建文章后，会同时出现同名目录：

```text
source\_posts\
├── 文章标题.md
└── 文章标题\
    └── example.png
```

在 Markdown 中引用：

```markdown
![图片说明](example.png)
```

不要引用电脑上的绝对路径，也不要把图片只放在 `public\`；`public\` 每次构建都会重新生成。

## 以后如何上传并发布

日常发布只需要：

```powershell
npm run validate
git pull --ff-only
git add -A
git diff --cached
git commit -m "post: 新增文章标题"
git push
```

推送后，GitHub Actions 会自动安装依赖、构建、检查并发布。可在仓库的 **Actions** 页面查看进度；成功后打开博客并强制刷新一次。

不要提交 `node_modules\`、`public\`、`db.json` 或 `.deploy_git\`，也不要再使用旧的 `hexo deploy`。

## 第一次迁移到自动发布

当前本地目录还没有源码 Git 历史，而远端 `lichermioneT.github.io` 的 `main` 保存的是旧的生成页面。第一次迁移只做一次：

1. 在 GitHub 仓库页面，从当前 `main` 创建备份分支，例如 `pages-static-backup-20260729`。
2. 打开仓库 **Settings → Pages**，把 **Source** 改为 **GitHub Actions**。
3. 在本目录初始化源码仓库：

   ```powershell
   cd D:\Desktop\lic
   git init
   git branch -M main
   git add -A
   git commit -m "chore: migrate Hexo source"
   git remote add origin git@github.com:lichermioneT/lichermioneT.github.io.git
   git fetch origin main
   git push --force-with-lease -u origin main
   ```

4. 到 GitHub 的 **Actions** 页面确认 `Deploy Hexo to GitHub Pages` 成功。

首次 push 需要改写旧的静态页面分支，因此必须先完成第 1 步备份；以后都使用普通 `git push`，不再强制推送。

## 常用命令

| 命令 | 用途 |
| --- | --- |
| `npm run dev` | 预览正式文章 |
| `npm run draft` | 连草稿一起预览 |
| `npm run build` | 清理并生成 `public\` |
| `npm run check` | 检查坏内部链接和示例配置 |
| `npm run validate` | 构建后执行完整检查 |

## 当前待补资源

`Linux进程概念.md` 原本引用的 20 张图片没有随仓库迁移。源码中已用“待补原图”注释保留文件名，当前页面不会再显示坏图；找到原图后放入 `source\_posts\Linux进程概念\picture\`，再恢复对应引用即可。

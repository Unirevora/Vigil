# 架构概览 · Vigil Inkpress v1.4.1

## 总体结构

```text
index.html
  └── src/main.js                  页面状态 / 事件与生命周期
       ├── ui/views/               概览、全部手记、编辑、阅读、日历、GitHub、数据管理
       ├── core/                   条目、日期、日历、Markdown 转义渲染
       ├── storage/                手记、草稿、备份与 JSON 迁移
       ├── github/api.js           GitHub REST 仓库文件客户端
       └── styles/                 基础变量、布局、控件、页面、响应式
```

## 数据存储

- `vigil-mvp-data-v1`：正式保存的手记，保留旧版 Schema v1，新增可选 `tags`、`mood`、`favorite`。
- `vigil-mvp-drafts-v1`：未完成草稿，与正式手记独立，650ms 防抖保存。
- `vigil-mvp-backups-v1`：正式手记完整快照，最多五份；删除、恢复、导入前建立安全快照。
- `vigil-github-repository-v1`：仓库所有者、仓库名称、分支、笔记目录，**不含访问令牌**。
- `vigil-theme-v1`：暖纸色或深夜墨色。

严禁在数据结构损坏时静默覆盖或将其替换成空数组；相应模块已做阻止写入的保护。

## 外部 GitHub 模块

`GithubClient` 封装 `/repos/{owner}/{repo}` 和 `/repos/{owner}/{repo}/contents/{path}`。目录按当前文件夹读取，文件用 Base64 UTF-8 解码。修改文件时传入旧版 SHA，要求服务器检查并发更新。连接配置可持久化，令牌只保留在当前页面内存。

- 匿名读取：公开仓库。
- 需要令牌：私有仓库，以及写入公开或私有仓库。
- 提交：GitHub Contents REST API `PUT`。
- 不自动把 GitHub 文件同步到本地手记，也不提供 OAuth 登录。
- 错误明确反馈，409 冲突时保留当前未提交文字。

## P1 功能

- `core/entries.js`：标签、心情、收藏字段与搜索筛选。
- `core/calendar.js`：日历网格、月份归档、往年今日。
- `ui/views/editor.js`：Markdown 工具栏与源码/预览切换。
- `ui/views/reader.js`：上一篇、下一篇、收藏。
- 样式：统一圆润卡片、低噪声布局、浅深主题。

## 未实现的范围

完整旧项目 v2.8.2 的历史 schema 和加密迁移、KaTeX、GitHub OAuth 与自动双向同步。不能把本次版本视为生产环境旧数据迁移已完成。

功能现状见 `IMPLEMENTATION.md`，GitHub 权限和故障说明见 `GITHUB.md`。

## v1.4.1 新增模块

- `src/storage/encrypted-transfer.js`：新的加密 JSON Schema（不是旧站加密格式），独立进行 AES-GCM 加解密。仍复用正式库 `validateDataset()`。
- `src/ui/passphrase.js`：临时口令输入窗，用户提交后擦除 DOM 输入，不进入持久化状态。
- `src/ui/command-palette.js`：本地快捷取词/操作，不加载远程服务，候选列表按需创建；用户文本只使用 `textContent`。
- `src/ui/motion.js`：可见卡片 WAAPI 进场动画，尊重减少动效系统偏好，不影响编辑光标。
- `src/styles/motion-141.css`：纸页回弹、桌面 79px 侧栏、手机菜单折叠与弹窗样式。
- 偏好 Key：`vigil-sidebar-collapsed-v1`（桌面布局）和 `vigil-mobile-nav-open-v1`（手机导航），与用户手记、GitHub 令牌分离。

应用部署时需要 HTTPS 或 `localhost` 才能使用 `crypto.subtle`；不可把本地 Web Crypto 加密备份宣传为已兼容原历史项目 v2.8.2 的加密文件。

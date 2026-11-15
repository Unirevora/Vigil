# 不眠手记 · Vigil Studio v1.2.0

一个本地优先、保留近代中式纸张质感的 Markdown 手记应用，并增加了 **GitHub 仓库浏览、预览和提交编辑**。

本项目使用独立的 HTML、CSS 和原生 JavaScript ES Modules，**不是单 HTML 文件**，不需要安装第三方运行依赖。

## 运行

Node.js 18+：

```bash
npm run dev
```

打开 `http://127.0.0.1:5173/`。

或使用 Python HTTP 服务：

```bash
python3 -m http.server 5173
```

**不要直接双击 `index.html` 使用 `file://`**。

运行单元测试：

```bash
npm test
```

## 本次主要变更

### 更简洁、更圆润的 UI
- 新的五个入口：概览、全部手记、日历与归档、GitHub 仓库、数据管理。
- 移除无意义的英文编号、冗余小字和过度拟物边框；将主操作集中在写作和阅读。
- 页面以圆角纸面、轻投影、暖灰、旧纸白、墨绿和朱砂点缀为主。
- 提供暖纸色 / 深夜墨色主题切换，保留两套用户自备字体的加载路径。
- 支持桌面和平板，以及 320 / 390px 手机布局。

### 功能扩展
- 标签、心情、收藏与筛选。
- 月份归档、日历日期筛选、往年今日。
- Markdown 写作工具栏和预览开关。
- 阅读页上一篇 / 下一篇。
- 草稿自动保存、最多五份本地备份及历史恢复。
- GitHub 工作区：输入现有仓库 URL、分支和文件夹，读取仓库目录、预览/修改/新建 Markdown、提交到远端。

### 数据与安全
- 正式手记仍存放在 `vigil-mvp-data-v1`；新增的标签/心情/收藏均为 **Schema v1 的可选字段**，读取上一版原型的历史记录时自动补齐默认值。
- 草稿键 `vigil-mvp-drafts-v1`，备份键 `vigil-mvp-backups-v1`，相互独立。
- GitHub **仓库配置**可以本地保存；GitHub **令牌**只保存在当前网页内存，刷新后需要重新提供。
- 公开仓库可以匿名预览；私有仓库或提交文件需要个人细粒度访问令牌。
- GitHub 远端文件与本地手记库**不自动双向同步**。远端保存会生成 Git 提交，并携带 SHA 检查并发冲突。
- 清除浏览器本地数据会同时删除本地手记、草稿与备份。务必定期导出 JSON。

## 在 GitHub 中预览与编辑

1. 点击左侧「GitHub 仓库」。
2. 输入 `https://github.com/owner/repo`。
3. 填写可选分支和笔记目录，例如 `notes`。
4. 公开仓库可以不填写令牌直接连接并预览。
5. 如果需要修改或读取私有仓库，使用 **fine-grained Personal Access Token**，只授权该仓库的 `Contents`（读写）。
6. 点击 Markdown 文件预览，选择「编辑文件」修改并提交，或点击文件列表上方 `+` 新建文件。
7. 修改前若远端版本有变化，`SHA` 冲突会阻止覆盖，保留编辑框文字。

本项目未接入 GitHub OAuth 账号网页登录（需要可信后端），也不要求安装 ChatGPT GitHub 插件。完整说明见 [`docs/GITHUB.md`](docs/GITHUB.md)。

## 字体

项目保留这两个本地路径：

```text
fonts/titlefont.ttf
fonts/textfont.ttf
```

你之前提供的 `titlefont.ttf` 与 `textfont.ttf` 没有重复附带在新压缩包内。请从你自己的项目中复制回 `fonts/` 文件夹，或使用：

```bash
python3 scripts/restore-fonts.py /path/to/your/original-vigil-rebuild.zip
```

未放入字体时自动退回系统中文字体，不影响功能。字体许可请以原字体授权为准。

## 项目结构

```text
index.html
package.json
src/
├── main.js
├── core/
│   ├── entries.js
│   ├── calendar.js
│   ├── markdown.js
│   └── format.js
├── github/
│   └── api.js
├── storage/
│   ├── repository.js
│   ├── schema.js
│   ├── drafts.js
│   ├── backups.js
│   └── transfer.js
├── ui/
│   ├── views/
│   ├── icons.js
│   └── feedback.js
└── styles/
    ├── foundation.css
    ├── layout.css
    ├── controls.css
    ├── pages.css
    └── responsive.css
tests/
scripts/
docs/
```

## 文档

- [`docs/MVP.md`](docs/MVP.md) — 原重构需求和 P0/P1/P2 功能分组。
- [`docs/IMPLEMENTATION.md`](docs/IMPLEMENTATION.md) — 本版实现状态与剩余限制。
- [`docs/DESIGN-SYSTEM.md`](docs/DESIGN-SYSTEM.md) — UI 配色与视觉规范。
- [`docs/GITHUB.md`](docs/GITHUB.md) — 仓库权限、配置、提交和冲突说明。
- [`CHANGELOG.md`](CHANGELOG.md) — 本次更新记录。

## 仍然不支持的功能

- 原项目 v2.8.2 的实际旧数据结构、历史加密文件、服务端私密入口（未提供源码验证）。
- 口令加密 JSON 迁移和 KaTeX 公式（P1 待办）。
- GitHub 自动同步、本地与仓库之间的合并冲突解决、OAuth 账号登录。
- 当前 GitHub 文件浏览按目录逐层展示，支持常见 Markdown 文件，不适合超大目录/二进制文件。

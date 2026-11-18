# AGENTS.md · 不眠手记 VIGIL Inkpress — 工作交接手册

给接手本项目的人或 AI 代理。读完本文即可开工；更深的细节在 `docs/`：

| 文档 | 内容 |
| --- | --- |
| `docs/ARCHITECTURE.md` | 模块职责、存储键、加密协议、样式体系、服务端脚本、安全边界 |
| `docs/PRODUCT.md` | 产品定位、P0/P1 状态表、非目标、后续方向 |
| `docs/QA.md` | 测试分层、验收流程、已知限制 |
| `docs/GITHUB.md` | GitHub 连接、同源中继、通道选择、代理、git-crypt、故障排查 |
| `docs/DEPLOY.md` | 服务器一键部署、nginx、回滚 |
| `docs/USER-GUIDE.md` | 面向用户的功能说明、快捷键、Markdown 语法 |
| `docs/CHANGELOG-original.md` | 原项目（v2.0–v2.8.2）历史，**只读，不得修改** |

当前版本以 `package.json` 为准（发稿时 1.7.8「浮笺」）。本文与代码冲突时，以代码为准，并顺手修正文档。

---

## 1. 项目是什么

- **复古文房风格、本地优先的 Markdown 手记工作台**，并把 GitHub 仓库作为与本地并列的第二文库。
- 原生 ES Modules 单页应用：`index.html` + `src/main.js`。**没有打包器、没有 npm 运行依赖**，只需 Node.js 18+。第三方库全在 `vendor/`（CodeMirror 5、KaTeX 0.16 ESM），**不引 CDN**。
- 设计原则：本地优先、用户拥有 Markdown 源文；数据稳定性优先于新功能；不把未实现/未验证的能力写成已完成；不为视觉效果牺牲数据安全、可访问性或减少动效偏好。
- 非目标：账号体系、云同步服务、完整 Obsidian 插件/CSS snippets 引擎、执行任意用户 CSS/脚本，以及原项目 v2.8.2 的数据迁移、存储 Schema 与加密格式兼容。

## 2. 命令速查

```bash
npm run dev            # 构建 CSS 并启动 scripts/dev-server.mjs（127.0.0.1:5173，同源 GitHub 中继）
npm run build:css      # 只重新打包 assets/vigil.css
npm test               # node --test tests/*.test.js（内置 node:test，无依赖）
npm run version:check  # 校验各处版本号一致（部署前强制）
node scripts/version.mjs 1.7.5 [发布名]   # 或 patch|minor|major，同步全部版本位置并在 CHANGELOG 顶部加段落
python scripts/qa-browser.py              # 离线 Chromium 端到端回归（需 Python Playwright）
npm run diagnose:github                   # GitHub 链路只读诊断（需先 npm run dev）
deploy.cmd | npm run deploy               # 一键部署（见第 12 节）
```

## 3. 目录与模块地图

```text
index.html               外壳：侧栏导航、顶栏、主区域、SVG 滤镜定义；<script type=module src=src/main.js>
src/main.js              启动装配、共享 state/gh、路由、本地 actions、草稿机、render、CodeMirror 单实例、键盘与生命周期；唯一的 DOM 协调者
src/core/                纯函数：entries(排序/检索/筛选/统计) format(日期/escapeHtml/字数) calendar almanac(节气)
                         markdown(阅读渲染) math(KaTeX 受限渲染) safe-html(白名单) diagnostics(APP_VERSION/RELEASE_NAME)
src/storage/             schema repository drafts backups transfer encrypted-transfer footprint
src/editor/              unified-editor(CodeMirror 单窗三态) live-markdown(语法识别) formatting(工具栏格式化)
src/github/              api(GithubClient) connection(三阶段) browser-diagnostics notebook(远端文库模型)
src/security/git-crypt.js
src/insights/insights.js 任务/双向引用/回顾指标   src/appearance/{settings,background}.js
src/glass/liquid-glass.js   src/effects/spectral-drape.js   src/data/demo.js(示例手记)
src/ui/                  action-dispatcher(合并注册表分发) github-controller(GitHub 域操作) data-controller(数据运维)
                         command-palette passphrase feedback motion themed-select tab-indicator almanac-controller icons
src/ui/views/            home entries entry-cards editor reader chronicle(calendar+almanac) insights github settings data about page-heading hero-paper index
src/styles/              tokens base controls dialogs glass pages home entries editor reader insights github tabs surfaces shell settings chronicle motion floating focus
scripts/                 build-css dev-server github-proxy github-transport diagnose-github deploy version style-order.json qa-browser.py restore-fonts.py pack-with-local-fonts.py
tests/                   *.test.js 与 tests/support/styles.js
assets/                  vigil.css（生成物，勿手改）、壁纸/纹样/印记等素材      fonts/  用户自备字体（不提交二进制）
vendor/                  codemirror/ katex/ NOTICE.md
```

要点：
- `core/` 只放纯函数，可在 Node 测试；**DOM 与全局状态只在 `main.js` 与 `ui/`**。
- 视图函数 `xxxView(state)` 返回 HTML 字符串，由 `main.js` 的 `render()` 写入并挂载控制器（编辑器在 `render()` 里 `mountUnifiedEditor`）。事件不在视图里绑，统一走 `data-action` 委托；新增交互按所属域在 `main.js` 本地 `actions` 或对应控制器的 `actions` 注册 handler，由 `createActionDispatcher` 合并分发。
- 所有资源、脚本、`api/...` 地址用**相对路径**（支持 `/vigil/` 子路径部署）。

## 4. 数据与存储（红线）

| 位置 | 键 | 内容 |
| --- | --- | --- |
| localStorage | `vigil-mvp-data-v1` | 正式手记 `{schemaVersion:1, entries:[…]}` |
| localStorage | `vigil-mvp-drafts-v1` | 草稿（≤40；本地键或 `github:<128 位哈希>`），650 ms 防抖 |
| localStorage | `vigil-mvp-backups-v1` | 最多 5 份快照；与最新快照相同则复用 |
| localStorage | `vigil-github-repository-v1` | owner/repo/branch/目录，**不含令牌** |
| localStorage | `vigil-appearance-v142` / `vigil-editor-mode-v142` | 外观偏好 / 编辑器上次模式 |
| localStorage | `vigil-sidebar-collapsed-v1` / `vigil-mobile-nav-open-v1` | 侧栏状态 |
| localStorage 只读 | `vigil-mvp-prototype-v1`、`vigil-theme-v1` | 旧键：只读一次，**从不删除** |
| IndexedDB | `vigil-appearance-image-v142`（store `images`） | 自定义背景 Blob |
| 仅内存 | — | GitHub PAT、git-crypt 密钥、备份口令、服务器端代理设置 |

条目 Schema v1：`id`、`title`(≤200)、`content`(Markdown 源文，**不存 HTML**)、`date`(归属日期，区别于 `createdAt`/`updatedAt`)、可选 `tags`(≤8，每个≤24 字)、`mood`(平静/喜悦/疲惫/思考/灵感)、`favorite`、`demo`、`legacy`(原样保留)。单次最多 10000 篇，导入上限 8 MB。

**不可违反**：
1. 所有正式手记读写只经 `LocalEntryRepository`。读到损坏/异常结构 → 进入只读并报错，**绝不以空数组覆盖**。
2. 删除、恢复快照、导入、任务回写**之前先建快照**；当前手记非空而快照失败 → 取消覆盖。
3. 导入只支持「确认后替换」，失败时现有数据不变；备份/导出只含正式手记（不含草稿、背景图、GitHub 内容、令牌）。
4. 键名不得改；不做静默迁移；Schema v1 与原项目「schema v2」是两套东西。原 v2.8.2 的数据迁移、存储 Schema 与加密格式兼容均为非目标，不要重新列为发布门槛。
5. 任务回写前须确认原文该行未变，否则拒绝。

## 5. 安全与 GitHub 约定

- PAT（Fine-grained，Contents 读写）、git-crypt 密钥、备份口令**只在内存**：不写存储、日志、导出、诊断。断开即清除。匿名勾选会丢弃已输入令牌。
- GitHub 手记是独立文库，**不并入本地 JSON**。写入 = `PUT` 带原 blob SHA（乐观锁）；409 冲突保留本机草稿；**PUT 绝不自动重试、绝不换通道**（网络中断时提交可能已成功）。不做 OAuth、自动双向同步、远端重命名。
- 通道：有 `<meta name="vigil-relay">`（dev-server 注入）或主机为 localhost/127.0.0.1 → 同源中继 `api/github/...`；否则直连。仅**匿名 GET**在网络类故障时依次尝试 `api/github` → `api/vigil-bridge`（仅无令牌 GET）→ 直连；GitHub 真实返回的 401/403/404/409/422 不触发换通道。中继请求 `credentials:'same-origin'`，直连 `omit`；每次请求取当时的 `globalThis.fetch`；`redirect:'error'`、`cache:'no-store'`。
- 中继只转发 `https://api.github.com` 的仓库/Contents 路径，查询仅允许 `ref`，PUT 只允许具体文件，正文≤3 MB，响应≤7 MB，上游超时 16 s，只信任回环 Host 与同源 Origin（否则 403 `ORIGIN_DENIED`），响应带 `X-Vigil-Github-Proxy: 1`。不是通用代理。服务器部署 `VIGIL_PROXY_LOCK=1`，代理设置锁为直连。
- 连接三阶段（仓库信息 → 目录与 Markdown 文件 → `.gitattributes`）各自报错；第三步失败只降级为只读警告，提交前仍强制重新校验规则。
- git-crypt：独立实现（v2 对称密钥，AES-256-CTR + HMAC-SHA1），先校验 HMAC 再返回文本；受保护路径无密钥 → 拒绝明文提交；规则不匹配 → 拒绝加密提交；规则不明确时拒绝猜测。
- 口令加密备份：PBKDF2-SHA256 **600000** 次、16 字节盐、AES-256-GCM、12 字节 IV、128 位标签，AAD 常量 `VIGIL/ENCRYPTED-JSON/V1/AES-256-GCM/PBKDF2-SHA256/600000`；口令≥10 字符；需安全上下文（HTTPS/localhost）。**与 git-crypt 是两套协议，参数与格式不得随意改动**，也不能解密原项目文件。
- Markdown **不执行 HTML**，只渲染 `safe-html.js` 白名单（`span/div/u/s/small/mark` + 有限的字体、字号、字距、文字色、对齐声明；事件属性、脚本、外部样式丢弃）。用户文本进 DOM 只经转义或 `textContent`。
- 诊断输出只含布尔状态与计数，不含正文、仓库路径或令牌。

## 6. 编辑器（最易出错的部分）

### 6.1 架构
- 一个 CodeMirror 5 实例承载**实时 / 阅读 / 源码**三态（`mountUnifiedEditor`，返回 `{getValue,setMode,format,findNext,replaceMatch,replaceAll,focus,destroy,getOutline,goToLine,undo,redo,cm,refresh}`）。切换模式**不替换文本、不丢撤销历史**。上次模式存 `vigil-editor-mode-v142`。
- `editor/live-markdown.js`：纯识别函数 `inlineSegments`、`markdownHeading`、`markdownListMarker`、`markdownRule`、`markdownTableAt`、`markdownMathBlockAt`、`markdownFenceAt`、`markdownQuoteAt`、`markdownSafeStart`。**只识别，从不改写文本。**
- `editor/formatting.js`：工具栏块级/行内格式化，只作用于用户选中的行，保留缩进，只替换一个块标记。
- 实时模式（`decorateNow`）：对视口±`PAINT_PAD`(70) 行的窗口重建装饰；非活动行隐藏语法标记（`markText collapsed`），活动行显示源码但已带样式；围栏/公式/表格/引用块在光标不在其内时整块替换为渲染小部件，光标进入时恢复源码并在块后显示预览。标题、引用、列表（项目符号/任务复选框/编号）、分割线（`---`/`***`/`___`→横线，规则与阅读渲染一致）逐行绘制；多余空行折叠为一个段落间距（可逆）。
- 稳定性约定（有测试 `editor-scroll-stability.test.js`）：窗口边缘不落在围栏/公式/表格/引用/段落中间（`markdownSafeStart`）；视口在已绘窗口内移动不重建装饰（`PAINT_TRIGGER`=18）；重绘时以视口顶行为锚点，高度变化后 `scrollTo` 复位；输入法组合期间（`composing`）不重绘；块小部件的间距用 border 而非合并 margin。
- 新增语法时：先在 `live-markdown.js` 加纯识别函数 + 测试，再在 `paintSimpleLine`/块分支接入；阅读渲染（`core/markdown.js`）与实时渲染的规则必须保持一致。

### 6.2 固定框架布局（v1.7.4，不要破坏）
- 编辑页高度由 `main.js::fitEditorFrame()` 计算并写入 `.composer-page.refined-editor` 的 `--editor-height`（视口高 − 元素顶部 − `.main-inner` 底部内边距，最小 480px）；在挂载编辑器前、`resize`、切换专注时调用。CSS 回退 `100dvh - var(--editor-gap)`。
- 结构：`section.composer-page` → `header.editor-topline`(返回/类型/草稿状态/保存) → `div.editor-stage`(grid：稿纸列 + 大纲列) → 可选 `div.editor-hint-dock`。`article.editor-paper` 是 flex 纵向：标题 → 日期与标签 `details.editor-properties`（GitHub 文件隐藏）→ 工具栏 → `.unified-manuscript`(flex:1) → 页脚（字数 + 模式提示）。
- **标题、日期与标签、工具栏固定，只有正文滚动**（`.CodeMirror` `height:100%`，`.unified-reader` `overflow:auto`）；页面本身不滚动。**禁止**给 CodeMirror/阅读区加 `min-height`/`max-height`/`vh` 上限；`mountUnifiedEditor` 的 `minHeight` 默认 0（曾因内联 510px 撑出视口）。
- **大纲 + 专注**：`aside.editor-outline-sidebar` 在 stage 的第二列。收起 = 稿纸右缘一枚带夹页折影的竖排书口签（`--outline-tab-top`:30px 与标题同高，`--outline-tab-h`:136px，上「大纲」下「专注」竖排短签 `.handle-vertical-label`，右移 −12px 露出边缘）；展开 = 向左长成与稿纸**等高**的纵向窗口，宽 `--outline-width`(272px)，stage 的 `grid-template-columns` 与 `column-gap` 同步过渡，稿纸略微让出宽度；用 `--outline-ease: cubic-bezier(.22,1,.36,1)` 约 0.52s；内容区用反向 `margin-top` 抵消窗口位移，**展开时文字不动**，右对齐锚定。展开后手柄淡出，专注按钮出现在大纲标题栏（✕ 左侧，仅图标）。收起时 `.editor-outline-sticky` 加 `inert`。≤900px 不挤正文，改为浮在稿纸右侧。动画结束后 `unifiedEditor.refresh()`。连续敲字时编辑器加 `.is-typing` 柔和退隐周边栏位（高度与位置不变），指针移动或聚焦控件即恢复。Esc 依次关闭：查找条 → 格式菜单 → 大纲 → 专注。
- 专注：`.shell.zen-mode` 隐藏侧栏与顶栏；所有 `.editor-zen-button` 同步 `active`/`aria-pressed`；快捷键 Ctrl/⌘+Shift+F。
- GitHub 文件提示「文件名由仓库路径决定；…校验 SHA 与加密规则。」在写作窗口外左下角（`.editor-hint-dock`），不在稿纸内。

### 6.3 快捷键
`Ctrl/⌘+S` 保存/提交 · `+B/+I` 加粗/斜体 · `+Z/+Y` 撤销/重做 · `+E` 实时↔阅读 · `+F/+H` 查找/替换 · `+Shift+F` 专注 · `+K` 命令面板 · `/` 聚焦列表检索框 · `Esc` 见上。

## 7. 样式体系

- 只改 `src/styles/*.css`，**不手改 `assets/vigil.css`**；改后 `npm run build:css`（`npm run dev` 自动构建）。层叠顺序唯一来源 `scripts/style-order.json`（现 21 个模块，含 `floating.css` 与 `focus.css`）。构建器纯 Node、不压缩，按顺序拼接并加源路径注释。
- 源 CSS 中资源地址写**项目根相对路径**（`/assets/x.webp`、`/fonts/x.ttf`），构建时换算为相对 bundle 的路径；引用不存在的文件会构建失败（用户自备字体除外）；相对路径 `url()` 被拒。`@font-face` 在 `tokens.css`。
- 需要压过遗留 `!important` 的规则放 `@layer overrides`（层内 `!important` 胜过未分层 `!important`）；注意：分层的 `!important` 会压过未分层的 `!important`，写新规则前先查是否被 `overrides` 层或 `surfaces.css`/`motion.css`/`focus.css` 覆盖。
- 比所属功能更靠后的规则要加注释说明为何必须后置。
- 清理旧样式时用 `grep` 确认选择器已无引用（视图、`main.js`、测试），一并删除；不要留「被覆盖的死规则」。

### 视觉规范（「铅字旧梦」）
- 朱砂 `#a83f2a` 默认主题色；墨色/主题色侧栏；宣纸、山水纹样、打字机静物（装饰，不拦截指针）；「眠」字印记（`assets/vigil-mark.svg`，favicon `vigil-favicon.svg`）。**不另建第二套视觉系统，不用霓虹色。**
- **主题色唯一色源** `--appearance-accent`（`main.js` 运行时同步到 `--accent`、`--accent-soft`、`--green`、`--green-soft`、`--sidebar-glass-*`、`--glass-material`）。六预设：朱砂、松绿、黛蓝、铜金、梅紫、墨青，可自选；侧栏可固定经典墨色。夜间侧栏中性石墨。
- 常用 token：`--bg --surface --paper --ink --ink-2 --muted --stroke --stroke-2 --side --accent --green --glass-panel-bg --glass-panel-blur --paper-opacity --wallpaper-alpha --color-focus --focus-ring --vigil-ease --vigil-spring --vigil-tab-bar --sidebar-width --sidebar-closed --workspace-max-width --page-title-size --font-display --font-body --font-typed --vigil-soft-shadow`。**先复用 token，不硬编码色值。**
- 夜间 `:root[data-theme=night]` 整套覆盖：背景 `#191b20`、纸面 `#30333a`、墨字 `#f2f1ed`；卡片背景与文字成对设置，别只改文字。
- **器透而纸温**：毛玻璃（镜面高光内边）用于导航、顶栏控件、搜索、弹层、卡片、筛选栏、统计、日历/节气面板、线索卡、GitHub 面板、设置面板、编辑工具栏、大纲、翻页/回响卡、空状态与对话框；**长文阅读与写作稿纸、节令短笺采用温润哑光棉纸**（`--paper-matte-bg`、`--paper-sheet-edge`、`--paper-sheet-shadow`）。不支持 `backdrop-filter` 或系统「减少透明度」→ 回退实色。稿纸的散射底衬画在 `::before` 底层（不要给稿纸本身加 `backdrop-filter`，否则会成为 fixed 后代的包含块）；阅读稿纸内天头（`.reading-header`）、正文与页脚严格对齐同一 `--reading-measure` 版心轴线，卡片正文摘要统一使用 `--font-body`（禁止对摘要混用标题字体 `--font-display`）。全站圆角收敛为 `--radius-sm`(10px) / `--radius-md`(14px) / `--radius-lg`(20px) / `--radius-pill`(999px) 四级。
- **标签页**统一：无背景高亮，选中项 4px 圆角主题色下划线（`--vigil-tab-bar`），`tab-indicator.js` 滑动；「全部手记 / 日历与风物 / 设置」共用。
- **标题**：每页唯一 `h1.page-title`（`pageHeading` 组件），字号 `--page-title-size`（桌面 `clamp(36px,3.35vw,52px)`，≤900 `clamp(34px,5.3vw,43px)`，≤640 `clamp(31px,8.2vw,38px)`），行高 1.14，字重 600；顶栏不重复页面名。
- **字体**：`VigilTitle`(`fonts/titlefont.ttf`，回退宋体)、`VigilText`(`fonts/textfont.ttf`，回退苹方/雅黑)；用户自备，不提交二进制，缺失只提示并回退。
- **动效**：`--vigil-ease`、`--vigil-spring`；设置可选轻盈回弹/更克制/关闭；**所有动画必须服从 `prefers-reduced-motion`**，并且「要平滑，不要生硬」（位置、尺寸、透明度同曲线过渡）。
- **全局浮动**：统一维护 `src/ui/floating.js` 与 `src/styles/floating.css`，只给最外层界面面板加轻微 3D 角度，嵌套元素随父面板移动，排除侧栏与顶栏；不分散写逐组件鼠标监听或倾斜规则。设置 `floating` 与幅度 `floatingIntensity`（0–100%，默认 50%）放在既有外观键中，在「外观」中与 Spectral Drape 相邻，支持热切换；减少动效、触屏、关闭动效与后台时停用。
- 浮动透视和实际倾角必须经 `floatingGeometry()` 按未变换尺寸约束，尺寸变化由共享 ResizeObserver 更新；禁止恢复所有页面共用固定 1800px 透视的旧做法。长列表与数百节长文需验证无极端投影放大，不能只测短稿纸。
- **滚动条全站隐藏**（不影响滚轮/触控/键盘）；鼠标点击不出现焦点方框，只有键盘 Tab 时显示淡淡圆角光晕（`focus.css`）。
- 布局宽度验证：320 / 390 / 768–810 / 1024 / 1440 / 1672 px，**不允许横向溢出**；≤900px 侧栏收为顶部并带底部快捷导航。
- 内置背景四个（晴岚、薄雾、素岸、月汐）各用不同文件，另有「我的背景」（IndexedDB）与纯色；玻璃场景图与当前壁纸一一对应采样。

设置页按「外观 / 排版 / 数据 / 关于」四类组织；材质、侧栏、纸纹、帷幕与浮动归外观。分类唯一来源 `settings.js::SETTINGS_TABS`，开关/滑杆/下拉行复用组件；不要加旧标签卡片或给单一特效额外包背景。
桌面设置入口在侧栏右下角，窄屏入口在顶栏。设置通过独立于页面路由的 `.settings-layer` 浮层打开，背景毛玻璃遮罩与窗口同步过渡。设置标题与标签位于 `.settings-heading`，只有 `.settings-hub-panel` 滚动，窗口高度由 CSS 随视口调整。导入/导出使用独立 `.data-action-card`，桌面等高两列、手机单列。

## 8. Markdown 支持矩阵（阅读/实时需一致）
H1–H6、有序/无序/任务列表、表格、围栏代码（`~~~` 也可）、引用与嵌套引用、Obsidian Callout（`> [!type] 标题`，`+`/`-` 折叠，可嵌套）、`[[wiki 链接]]`、分割线（`---`/`***`/`___`）、行内粗体/斜体/删除线/行内代码/链接（http、https、mailto）、KaTeX 公式（`$..$`、`\(..\)`、块级 `$$..$$`/`\[..\]`，MathML 输出，安全模式）、白名单 HTML 标签。表格/代码/引用/公式在实时模式整块渲染。

## 9. 工作方式与协作约定

- **只改被要求的**：用户说「别的不要动」，就不要顺手重构、改文案、改无关样式。需求含糊时选最合理解释并在回复里**明说**，不要反复追问；若用户纠正理解，迅速回退并以新理解为准，同时回退文档/日志/测试里的相应改动。
- **改完必须实测**：`npm test` 全绿；界面改动用 Playwright + 本机 Edge 在 1440/1100/800/390 宽度加载应用，检查：无 JS 错误、无横向溢出、编辑页无整页滚动、用长笔记（≥40 节）滚动三种模式时标题/工具栏不动、大纲展开时高度与稿纸一致且文字不跳。动画用逐帧采样位置验证，不凭感觉。
- **如实报告**：区分「离线夹具/本地 HTTP/真实网络账户」三类验证，不得互相替代；没验证的写「未验证」；遗留风险单独列出。回复用中文、结论在前、简洁。
- 同一版本内继续迭代**不升版本号**，只修订该版本的 CHANGELOG 段落；只有用户明确要求才升版本。
- **清理**：删旧样式/旧素材/旧测试断言前先 `grep` 全仓库确认无引用，并同步测试，再补「旧写法不再出现」的反向断言。截图、临时脚本用完即删，不留在仓库；脚本放项目外或用完删除。

## 10. 版本、更新日志、文档
- 版本唯一来源 `package.json`；`scripts/version.mjs` 同步：`package.json`（version+description）、`index.html` 侧栏、`src/core/diagnostics.js`（`APP_VERSION`、`RELEASE_NAME`）、`README.md` 标题、`CHANGELOG.md` 新段落；`--check` 必须通过（`tests/release-173.test.js` 也会校验）。发布名两个汉字（清简、流光、定框…），显示在「关于」页。
- `CHANGELOG.md` 段落格式：`## vX.Y.Z · 名称` + **加粗一句话概述** + 分节（编辑器 / 修复 / 交互 / 文档与测试资料 / 清理…）+ 要点列表；写清用户可感知的变化与删除了什么。
- 行为改变要同步：`docs/USER-GUIDE.md`、`docs/ARCHITECTURE.md`（尤其样式/布局描述）、`src/ui/views/about.js` 的「当前版本」三条亮点、必要时 `docs/QA.md`、`docs/PRODUCT.md` 状态表。

## 11. 测试约定
- 分层：单元/集成（`npm test`）· 离线浏览器回归（`qa-browser.py`，注意它默认找 `/usr/bin/chromium`，Windows 上需 `channel='msedge'`）· 网络诊断 · 部署健康检查。
- 新功能同步补测试；涉及数据写入的**必须含「损坏/拒绝时不改动现有数据」的负面用例**。网络测试只用本地伪造上游与无效令牌，不访问 `api.github.com`。安全断言：令牌/密钥不落盘、带令牌与 PUT 不换通道不重试、诊断不含正文/路径/令牌。
- 契约测试读取样式用 `tests/support/styles.js`（`readStyles()` 按 style-order 拼接，`readStyle('tabs')` 读单模块），按规则内容断言，不依赖文件名。主题：数据（storage/drafts/backups/core/features）、加密（encrypted-transfer）、git-crypt、Markdown/编辑器（math-142/editor-refine/editor-scroll-stability/release-170）、GitHub 与网络（github*/hotfix-network-155/repair-155）、界面契约（ui-reference/appearance-*/chronicle-154/release-15x/17x/tab-indicator/subpath-deploy）。
- 发布前手动验收：先导出备份 → 新建/编辑/保存/阅读/删除 → 加密导出再导入（HTTPS）→ 自定义背景刷新仍在 → 用自己的 Fine-grained PAT 连仓库浏览/编辑/提交（加密仓库测 export-key）→ 中文输入法长段落与撤销 → 深浅主题与减少动效。

## 12. 部署
`deploy.cmd`/`npm run deploy [--skip-tests] [--no-nginx]`：本地查字体、构建 CSS、跑测试 → 检查 SSH/sudo/node/nginx → 打包上传（排除 `.git`、`node_modules`、日志）并在服务器再测 → 切换版本（旧版进 `~/vigil-inkpress.prev`）→ 写 `vigil.service`/nginx 片段 → 健康检查（页面/样式/主程序 200、中继自检 200、跨站 POST 403、代理锁 409、HTTP→HTTPS 301、页面含 `vigil-relay`）。任一必检项失败自动回滚。子路径 `/vigil/`，HTTPS 是加密备份/git-crypt/剪贴板的前提。部署前 `version:check` 必须通过。

## 13. 常见任务清单
- **新增页面**：`ui/views/xxx.js` 返回 HTML → 在 `views/index.js` 注册 → `main.js` 路由与 `data-action`；标题用 `pageHeading`；补 CSS 模块规则与测试。
- **新增 data-action**：按所属域在 `main.js` 本地 `actions` 或 `githubController.actions` / `dataController.actions` 注册 handler；不要在视图里绑定事件，按钮带 `aria-label`/`title`，并补 action 覆盖测试。
- **新增存储键**：先评估必要性；用独立常量；读失败不得覆盖；补负面用例；更新本文第 4 节与 `ARCHITECTURE.md`。
- **改样式**：改模块 → `npm run build:css` → 浏览器实测多宽度/夜间/减少动效 → 清死规则 → 更新契约测试。
- **加素材**：放 `assets/`，在 CSS 源里写根相对路径；删素材前 grep 引用（含 `tests/ui-reference.test.js` 的素材清单）。

## 14. 本机环境提示（Windows）
- 终端是 Windows 上的类 bash（`brush.exe`）：`python3` 是应用商店占位程序，请用 `python`；`sed -i`、含反引号的大段 heredoc、`npm` 可能失败或卡死。批量修改文件的稳妥做法：用 Write 在项目目录内生成临时 `.mjs`（读文件→`\r\n` 归一→改→还原换行），`node` 运行后立即删除。
- 项目路径在 bash 中是 `/workspace/e/experiments/vigil-rebrith/vigil`；Python/Node 看到的是 `E:\…`。Read 工具看不到 `/tmp` 下的文件，截图需先复制到项目目录再读取，读完删除。
- 浏览器验证：Playwright（Python）+ `chromium.launch(channel='msedge', headless=True)`；复用 `scripts/qa-browser.py` 的页面装配逻辑（把真实模块内联为 blob，离线加载），点击 `[data-action=new]` 进入编辑器。

## 15. 未实现 / 边界（别当成已完成）
OAuth、本地↔GitHub 自动双向同步、远端重命名、合并差异、自绘取色器/日期选择器、纸张 3D/翻页动画、竖排与画卷首页、多语言热切换（仅简体中文）、语义搜索、语音/附件。原 v2.8.2 的数据迁移、存储 Schema 与加密格式兼容是明确非目标，不属于待实现或待验证清单。真实私有仓库、组织权限与原生 git-crypt CLI 文件互操作只能在用户自己的环境验证。

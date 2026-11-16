# 架构说明 · 不眠手记 VIGIL Inkpress

> 本文描述**当前代码**（`package.json` 版本 1.7.1）。它合并并取代了按版本命名的旧文档：原 `ARCHITECTURE.md`、`STRUCTURE-1.5.6.md`、`DESIGN-SYSTEM.md`、`IMPLEMENTATION.md`、`ENCRYPTED-BACKUP.md`、`REFERENCE-UI.md`、`SOURCE-ALIGNMENT.md`。产品范围与实现状态见 `PRODUCT.md`，测试方式见 `QA.md`，服务器部署见 `DEPLOY.md`。

## 1. 总体形态

- 多文件原生 ES Modules 单页应用：`index.html` + `src/main.js`，**没有打包器、没有 npm 运行依赖**；只需 Node.js 18+。
- 第三方库全部在 `vendor/` 本地提供：CodeMirror 5（核心、Markdown mode、列表延续）与 KaTeX 0.16.x ESM（`vendor/katex/katex.mjs`，MathML 输出，不加载字体二进制）。许可见 `vendor/NOTICE.md`。
- 样式只有一个运行时请求：`assets/vigil.css`，由 `scripts/build-css.mjs` 从 `src/styles/` 的功能模块生成（见第 5 节）。
- `scripts/dev-server.mjs` 是自带的静态服务器兼 GitHub 同源中继，只监听 `127.0.0.1`。`npm run dev` / `npm start` 先构建 CSS 再启动它，默认 `http://127.0.0.1:5173/`。
- 所有资源、脚本与 `api/...` 中继地址都写成**相对路径**，因此可以部署在子路径（如 `/vigil/`）下。

```text
index.html                 外壳：侧栏导航、顶栏操作、主区域、SVG 滤镜定义
└── src/main.js            全局状态、路由、事件委托、生命周期（唯一的 DOM 协调者）
    ├── core/              纯函数：条目、日期、日历、节气、Markdown、公式、安全 HTML、诊断
    ├── data/              首次运行的示例手记
    ├── storage/           localStorage 仓库、草稿、快照、JSON 与加密导入导出、占用统计
    ├── editor/            CodeMirror 单窗三态编辑器与实时排版
    ├── github/            GitHub REST 客户端、连接步骤、浏览器链路诊断、远端文库模型
    ├── security/          git-crypt 二进制格式（浏览器 Web Crypto 实现）
    ├── insights/          线索与行动：任务、双向引用、回顾指标
    ├── appearance/        外观偏好与自定义背景图片（IndexedDB）
    ├── glass/             液态玻璃光学层
    ├── effects/           点阵帷幕 Canvas 特效
    ├── ui/                通用 UI 组件与 views/ 页面渲染
    └── styles/            CSS 功能模块（构建为 assets/vigil.css）
```

## 2. 源码模块

### core/

| 文件 | 职责 |
| --- | --- |
| `entries.js` | 排序、全文检索、组合筛选（标签、收藏、日期、心情、近七天、未完成任务；任务识别忽略代码围栏）、统计、由草稿构建条目 |
| `format.js` | 日期工具、`escapeHtml`、UUID、字数、摘要 |
| `calendar.js` | 月历网格、月份归档、往年今日 |
| `almanac.js` | 二十四节气（太阳视黄经近似，UTC+8）、三候、农历标签、近似月相、节气盘模型 |
| `markdown.js` | 阅读渲染：H1–H6、列表/任务、表格、代码、引用、Obsidian Callout（`[!type]`、`+`/`-` 折叠、可嵌套）、`[[wiki 链接]]`、公式 |
| `math.js` | 公式分隔符扫描与受限 KaTeX 渲染（MathML） |
| `safe-html.js` | 白名单 HTML：仅 `span`/`div`/`u`/`s`/`small`/`mark` 与有限的字体、字号、字距、文字色、对齐声明；事件属性、脚本、外部样式一律丢弃 |
| `diagnostics.js` | `APP_VERSION`（与 `package.json` 一致，测试会校验）与「关于」页的本地环境诊断，只输出布尔状态与计数 |

### storage/

| 文件 | 职责 |
| --- | --- |
| `schema.js` | Schema v1：`normalizeEntry`、`validateDataset`、`makeDataset`；单次最多 10000 篇、导入 8 MB |
| `repository.js` | `LocalEntryRepository`：所有正式手记读写的唯一入口；数据损坏时进入只读，**绝不以空数组覆盖** |
| `drafts.js` | `DraftRepository`：最多 40 份草稿，与正式手记隔离 |
| `backups.js` | `BackupRepository`：最多 5 份完整快照；与最新快照内容完全相同时复用、不占新槽 |
| `transfer.js` | JSON 导出、导入解析 |
| `encrypted-transfer.js` | 口令加密 JSON 备份（第 4 节） |
| `footprint.js` | 只读估算以 `vigil-` 开头的 localStorage 键值长度（UTF-16），不读内容、不统计 IndexedDB |

### editor/

- `unified-editor.js`：一个 CodeMirror 实例承载「实时 / 阅读 / 源码」三态；切换模式不替换文本、不丢撤销历史。实时模式用装饰 mark 隐藏非活动行的语法标记、渲染公式小部件、可勾选任务；包含查找替换（Ctrl/⌘+F、Ctrl/⌘+H）。
- `live-markdown.js`：行内分段、标题、列表、表格、公式块、围栏、引用块的识别。
- `formatting.js`：工具栏与格式下拉菜单的块级/行内格式化与插入模板。

### github/ 与 security/

- `api.js`：`GithubClient` 封装 Contents REST API（仓库元数据、目录、文件 GET，`PUT` 写入时携带原 blob SHA 做乐观锁）。路由策略：页面带 `<meta name="vigil-relay">`（由自带 Node 服务注入）时走同源 `api/github/...` 中继；匿名公开仓库读取可依次尝试主中继、备用中继 `api/vigil-bridge/...`、浏览器直连。**带令牌的请求与所有 `PUT` 绝不切换通道或重试**。同源中继请求 `credentials:'same-origin'`，直连 GitHub 为 `omit`。浏览器直连不发送 `X-GitHub-Api-Version`；中继向上游发送 `2022-11-28`。
- `connection.js`：连接分「仓库信息 → 根目录与 Markdown 文件 → 加密属性规则」三步，各步单独报错；`.gitattributes` 读取失败只降级为只读警告，提交前仍强制重新校验。
- `browser-diagnostics.js`：「浏览器链路检查」，探测诊断接口、两条同源路径与匿名直连，不发送凭据。
- `notebook.js`：远端文库模型。GitHub 手记是与本地并列的独立文库，**不合并进本地 JSON**；远端草稿键为 `github:<128 位哈希>`，由 owner/repo/branch/path 派生，键中不含路径或令牌。
- `security/git-crypt.js`：git-crypt 0.4–0.8 导出的 v2 对称密钥（key version 0）与 `\0GITCRYPT\0` 文件格式的独立实现：AES-256-CTR + HMAC-SHA1 合成 nonce，解密后先校验 HMAC 再返回文本。密钥只以不可导出的 `CryptoKey` 存在页面内存。`.gitattributes` 规则匹配支持常见通配与命名 key；受保护路径无密钥时拒绝明文提交，规则不匹配时拒绝加密提交。

### 其他模块

- `insights/insights.js`：从 `- [ ]` 收集任务（识别 `📅`、`due:`、`截止:`、`期限:` 后的 `YYYY-MM-DD`）、勾选时校验原文行未变再回写并先建快照；`[[标题]]` 双向引用与未解析链接；近七日、连续记录、标签等回顾指标与每日回顾提问。全部本地计算。
- `appearance/settings.js`：外观默认值、白名单规范化（旧背景值 `plum`/`bamboo`/`waves` 自动映射）、主题色派生侧栏色板；`appearance/background.js`：自定义图片以 Blob 存入 IndexedDB，并做 Canvas 压缩。
- `glass/liquid-glass.js`：悬浮控件的光学层。支持时挂 SVG `feDisplacementMap`（`#vigil-glass-bend`），同时绘制与当前壁纸对齐、仅边缘位移的 Canvas 作为稳定背衬；文字与焦点环不受影响。
- `effects/spectral-drape.js`：原创 Canvas 2D 点阵帷幕，默认关闭；DPR 受限、≤30fps、页面隐藏时暂停、减少动态效果时只画静态帧。
- `ui/`：`command-palette.js`（Ctrl/⌘+K 本地检索与跳转）、`passphrase.js`（临时口令弹窗，关闭即清空）、`feedback.js`（toast 与确认框）、`motion.js`（WAAPI 进场动画）、`themed-select.js`（自绘浮层下拉，原生 `<select>` 仍是状态源与无障碍基础）、`tab-indicator.js`（所有 `.vigil-tabs` 共用的滑动下划线，重渲染后用 WAAPI 从旧位置动画到新位置）、`almanac-controller.js`（节气盘拖拽/滚轮/键盘，空闲 3 秒回到今天）、`icons.js`。
- `ui/views/`：`home`、`entries`（本地手记 / GitHub 仓库两个同级页签）、`entry-cards`、`editor`、`reader`、`chronicle`（日历与风物合页，内嵌 `calendar` 与 `almanac`）、`insights`、`github`、`settings`（外观 / 排版 / 交互 / 数据 / 关于五个页签）、`data`、`about`、`page-heading`（每页唯一主标题组件）、`hero-paper`。`index.js` 导出视图表，旧视图名仍可作为别名渲染。

## 3. 数据与存储

### 存储键

| 位置 | 键 | 内容 |
| --- | --- | --- |
| localStorage | `vigil-mvp-data-v1` | 正式手记，`{schemaVersion:1, entries:[…]}` |
| localStorage | `vigil-mvp-drafts-v1` | 草稿（本地键或 `github:<hash>`），输入 650 ms 防抖保存 |
| localStorage | `vigil-mvp-backups-v1` | 最多 5 份快照，`{schemaVersion:1, backups:[{id,createdAt,reason,label,entries}]}` |
| localStorage | `vigil-github-repository-v1` | 仓库 owner、repo、分支、目录，**不含令牌** |
| localStorage | `vigil-appearance-v142` | 外观偏好（主题、主题色、背景、透明度、字体、排版、侧栏、动效、点阵帷幕等） |
| localStorage | `vigil-editor-mode-v142` | 编辑器上次使用的模式 |
| localStorage | `vigil-sidebar-collapsed-v1` / `vigil-mobile-nav-open-v1` | 桌面侧栏折叠 / 手机导航展开 |
| localStorage（只读） | `vigil-mvp-prototype-v1` | 早期原型的数据键：当前键不存在时复制一次，**从不删除** |
| localStorage（只读） | `vigil-theme-v1` | 旧主题键：仅在没有外观偏好时读取一次夜间设置，之后主题保存在外观偏好中 |
| IndexedDB | `vigil-appearance-image-v142`（store `images`） | 自定义背景 / 首页静物图片 Blob |
| 仅内存 | — | GitHub PAT、git-crypt 密钥、备份口令、服务器端代理设置 |

### 条目 Schema v1

`id`、`title`（≤200）、`content`（Markdown 源文，不存 HTML）、`date`（归属日期）、`createdAt`、`updatedAt`，可选 `tags`（≤8 个，每个 ≤24 字）、`mood`（平静 / 喜悦 / 疲惫 / 思考 / 灵感）、`favorite`、`demo`，以及原样保留的 `legacy` 对象。旧数据缺失字段在读取时补齐。

### 数据安全规则

- 读取到无法解析或结构异常的数据时报错并阻止写入，不静默清空。
- 删除、恢复快照、导入、任务回写之前先建快照；当前手记非空而快照失败时，取消覆盖。
- 导入只支持「确认后替换」，失败时现有数据不变。
- 备份与导出只包含正式手记，不含草稿、背景图片、GitHub 内容或令牌。
- 本项目的 Schema v1 **不是**原项目 v2.8.2 的存储格式；不做任何静默迁移。

## 4. 口令加密备份协议

新设计的独立格式，**不能解密原项目 v2.8.2 的加密文件**（其格式从未获得源码或样本）。实现：`src/storage/encrypted-transfer.js`；测试：`tests/encrypted-transfer.test.js`。

- 需要安全上下文（HTTPS 或 localhost）的 Web Crypto；否则直接报错。
- 明文：`exportJson(entries)`，即 Schema v1 JSON，上限 8 MB。
- 密钥：PBKDF2-HMAC-SHA256，**600000** 次迭代，每次随机 **16 字节盐**，派生 AES-256 密钥。
- 加密：AES-256-GCM，每次随机 **12 字节 IV**，**128 位**认证标签。
- AAD 常量：`VIGIL/ENCRYPTED-JSON/V1/AES-256-GCM/PBKDF2-SHA256/600000`，防止文件头参数被替换。
- 新口令至少 10 个字符（按 Unicode 字符计）；口令只在弹窗与本次操作的临时变量中，不写入存储。忘记口令无法找回。
- 文件名 `vigil-private-YYYY-MM-DD.vigil.json`，结构：

```json
{
  "format": "vigil-encrypted-json",
  "version": 1,
  "kdf": "PBKDF2-SHA256",
  "iterations": 600000,
  "cipher": "AES-256-GCM",
  "salt": "<Base64，16 字节>",
  "iv": "<Base64，12 字节>",
  "ciphertext": "<Base64，密文 + 认证标签>"
}
```

导入流程：文件 ≤12 MB → JSON 解析 → 严格核对 `format`/`version`/`kdf`/`iterations`/`cipher` → 校验 Base64 与盐/IV 长度、密文长度 → 输入口令并 GCM 认证解密（口令错误或篡改统一报错，当前手记不变）→ 以 Schema v1 校验明文 → 确认覆盖 → 建导入前快照 → 写入。「导入手记」也会自动识别此格式并要求口令。

威胁模型：只保护静态备份文件；正式手记与草稿在浏览器中仍为明文。页面来源被篡改、设备被控制或口令过弱时无法保护。口令加密 JSON 与 git-crypt 是两套不同协议，不可互换。

## 5. 样式体系

### 模块与构建

`src/styles/` 正从按版本命名的补丁层（`vigil-153.css` 等）重组为**按功能命名的模块**。`scripts/style-order.json` 是唯一的层叠顺序清单：

```text
tokens → base → controls → dialogs → glass → pages → home → entries
→ vendor/codemirror/codemirror.css → editor → reader → insights → github
→ tabs → surfaces → shell → settings → chronicle → motion
```

- `scripts/build-css.mjs`（纯 Node，无依赖、不做基于正则的压缩）按清单顺序合并为 `assets/vigil.css`，每段前加 `/* ---- 源路径 ---- */` 注释。只接受 `src/styles/` 与 `vendor/codemirror/` 下的 `.css`。
- 源模块中的资源地址一律写**项目根相对路径**（`/assets/x.webp`、`/fonts/x.ttf`）；构建时改写为相对 bundle 的路径（`x.webp`、`../fonts/x.ttf`），以支持子路径部署。引用不存在的文件会**直接失败**（用户自备字体除外，缺失时只提示并回退系统字体）；相对路径的 `url()` 被拒绝。
- 少数规则放在比其功能更靠后的模块里，因为它必须在被它细化的那条规则之后层叠；这类规则前有注释 `/* (原功能) kept in this module: it must cascade after the rule it refines above. */`。
- 需要压过遗留 `!important` 声明的规则放在 `@layer overrides { … }` 中：层内的 `!important` 胜过所有未分层的 `!important`，无需比拼选择器优先级。
- 修改 CSS 后执行 `npm run build:css`（或重启 `npm run dev`）。不要手改 `assets/vigil.css`。

### 视觉语言

延续「铅字旧梦」的复古文房：墨色 / 主题色侧栏、朱砂「眠」印记（`assets/vigil-mark.svg`，favicon 为 `vigil-favicon.svg`）、宣纸与山水、打字机静物（`assets/typewriter-still-life.webp`，纯装饰、不拦截指针）。不另建第二套视觉系统。

- **纸面与玻璃分工**：毛玻璃用于导航、顶栏操作控件、搜索、弹层，以及卡片、筛选栏、首页统计、日历/节气面板、线索卡、GitHub 面板、设置面板、编辑工具栏、大纲与对话框；**长文阅读与写作稿纸保持不透明**。浏览器不支持 `backdrop-filter` 或系统开启「减少透明度」时回退为实色。
- **主题色**：`--appearance-accent` 是唯一色源，运行时由 `main.js` 同步写入 `--accent`、`--accent-soft`、`--green`、`--green-soft`、侧栏 `--sidebar-glass-*` 与 `--glass-material`。六种预设：朱砂 `#a83f2a`（默认）、松绿、黛蓝、铜金、梅紫、墨青，也可自选色；侧栏可固定为经典墨色。夜间侧栏为中性石墨（`#26272c → #191a1f`），只保留主题色作选中标记。
- **夜间**：`:root[data-theme=night]` 整套覆盖（背景 `#191b20`、纸面 `#30333a`、墨字 `#f2f1ed`），卡片背景与文字成对设置，不使用霓虹色。
- **标签页**：「全部手记」「日历与风物」「设置」统一为一种样式：无背景高亮，选中项是 4 px 圆角主题色下划线（`--vigil-tab-bar`），由 `tab-indicator.js` 滑动。
- **标题**：每页一个 `h1.page-title`，`--page-title-size` 桌面 `clamp(36px,3.35vw,52px)`、≤900px `clamp(34px,5.3vw,43px)`、≤640px `clamp(31px,8.2vw,38px)`，行高 1.14，字重 600。顶栏不重复页面名。
- **字体**：`--font-display`（`VigilTitle` = `fonts/titlefont.ttf`，回退宋体）、`--font-body`（`VigilText` = `fonts/textfont.ttf`，回退苹方/雅黑）、`--font-typed`（等宽）。字体文件由用户自备，不随源码分发（见 `fonts/README.md`、`scripts/restore-fonts.py`）。
- **动效**：`--vigil-ease`、`--vigil-spring: cubic-bezier(.2,1.22,.31,1)`；设置中可选轻盈回弹 / 更克制 / 关闭；始终服从 `prefers-reduced-motion`。
- **布局**：侧栏 `--sidebar-width: clamp(226px,15.9vw,270px)`，折叠 `--sidebar-closed: 79px`；≤900px 侧栏收为顶部并可折叠，底部有快捷导航；工作区最大宽度 `--workspace-max-width`（用户可调）；编辑器大纲是叠在稿纸右缘的浮层：收起时为露出边缘的小标签，展开时向左过渡为与稿纸等宽的窗口，不挤占正文。验证宽度 320 / 390 / 768–810 / 1024 / 1440 / 1672 px，不允许横向溢出。

### 主要 token（以 `assets/vigil.css` 为准）

| token | 日间 | 夜间 | 用途 |
| --- | --- | --- | --- |
| `--bg` | `#f2f3ef` | `#191b20` | 页面底色 |
| `--surface` / `--paper-light` | `#fffefa` | `#30333a` / `#343840` | 卡片与稿纸 |
| `--paper` | `#f7ead5` | `#30333a` | 暖纸色 |
| `--ink` / `--ink-2` / `--muted` | `#263333` / `#52615d` / `#81908a` | `#f2f1ed` / `#d3d7d4` / `#afb8b5` | 文字层级 |
| `--stroke` / `--stroke-2` | `#e5e7dc` / `#d7dbd1` | `#4b505a` / `#626873` | 分隔线、边框 |
| `--side` | `#243d3b` | `#22262c` | 侧栏基色（实际由主题色派生覆盖） |
| `--accent` / `--appearance-accent` | `#a83f2a` | 主题色向浅色混合 | 朱砂 / 主题色 |
| `--green` | `#29483d` | `#6d8876` | 主操作（运行时被主题色覆盖） |
| `--glass-panel-bg` / `--glass-panel-blur` | `--surface` 按 `--paper-opacity` 混透明，`blur(22px) saturate(1.45)` | 独立的边缘与阴影 | 毛玻璃面板 |
| `--paper-opacity` / `--wallpaper-alpha` | 91% / .24 | — | 用户可调的纸面透光与壁纸强度 |
| `--color-focus` / `--focus-ring` | 主题色 | `#c28e80` | 焦点环 |

### 背景资源

四个内置预设各用不同文件：晴岚、薄雾、素岸、月汐（WebP，原分辨率），另有「我的背景」（IndexedDB）与纯色。玻璃场景图 `--glass-scene-url` 日间 `wallpaper-mist-3200.webp`、夜间 `wallpaper-moon-3200.webp`，与当前壁纸一一对应采样。

## 6. 服务端脚本

| 脚本 | 作用 |
| --- | --- |
| `build-css.mjs` / `style-order.json` | CSS 打包（第 5 节） |
| `dev-server.mjs` | 静态服务 + 注入 `vigil-relay` 标记；`.mjs`/`.md`/`.webp` 等 MIME 正确 |
| `github-proxy.mjs` | 严格的同源 GitHub 中继：只放行应用需要的 REST 路由，固定上游主机，不记录 Authorization 与正文；`/api/github/health`（仅本地存活）、`/api/github/diagnose`（真实上游）、`/api/github/proxy`（代理设置，仅回环地址、仅进程内存）；备用路径 `/api/vigil-bridge/` 只允许无令牌 GET |
| `github-transport.mjs` | 上游传输：`HTTPS_PROXY`/`HTTP_PROXY`/`ALL_PROXY`/`NO_PROXY`，HTTP CONNECT 与 SOCKS5（远端 DNS），始终校验证书 |
| `diagnose-github.mjs` | `npm run diagnose:github`：六阶段只读诊断，不读取或打印任何 PAT |
| `deploy.mjs`（+ 根目录 `deploy.cmd`） | 一键部署与健康检查，见 `DEPLOY.md` |
| `qa-browser.py` | 离线 Chromium 回归，见 `QA.md` |
| `restore-fonts.py` / `pack-with-local-fonts.py` | 恢复 / 打包用户自备字体 |

服务器部署时设置 `VIGIL_PROXY_LOCK=1`：代理设置对所有访客共享且指向服务器本机，因此锁定为直连，页面无法修改。

## 7. 安全边界汇总

- GitHub PAT（Fine-grained，Contents 读写）只在页面内存；匿名连接只读。远端写入必须带 SHA，409 冲突时保留本机草稿，不自动覆盖、不重试 PUT。
- 不提供 OAuth、自动双向同步或远端文件重命名。
- Markdown 不执行 HTML；只渲染白名单标签与样式声明。用户文本在命令面板等处只经 `textContent` 写入。
- 加密备份、git-crypt、剪贴板依赖安全上下文，部署必须使用 HTTPS 或 localhost。

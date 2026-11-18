# 不眠手记 · VIGIL Inkpress 1.7.6

**复古文房、单页 Markdown 工作台，以及现在与本地手记并列的 GitHub 文库。** 这是模块化 HTML/CSS/JavaScript 项目，不是单 HTML 文件。延续 1.5.x 的朱砂、墨色、宣纸与玻璃控件，保留原有本地存储结构。

## 启动

需要 Node.js 18+。项目内已有 CodeMirror、KaTeX 等静态资源，无需从 CDN 下载。

```bash
npm run dev
```

访问 **http://127.0.0.1:5173/**。此命令会构建 `assets/vigil.css` 并启动自带的 HTTP 服务。`npm run build:css` 只重新打包 CSS，`npm test` 执行单元测试；浏览器回归脚本需要本机 Python Playwright + Chromium：

```bash
python scripts/qa-browser.py      # 设置 VIGIL_QA_SHOTS=<文件夹> 可保存截图
```

## 修改版本号

版本号以 `package.json` 为准，其余位置（侧栏、关于页与诊断、README 标题、更新日志）由脚本统一同步。Windows 下**双击 `version.cmd`**，按提示输入新版本号和发布名即可；也可以用命令行：

```bash
node scripts/version.mjs              # 查看版本并检查各处是否一致
node scripts/version.mjs 1.7.4 墨痕    # 设为 1.7.4，发布名「墨痕」（显示在「关于」页）
node scripts/version.mjs patch        # 自动递增：patch / minor / major
```

新版本会在 CHANGELOG.md 顶部自动添加一个待填写的段落。一键部署前会检查版本号，不一致时拒绝部署。

## 部署到服务器

Windows 下直接**双击项目根目录的 `deploy.cmd`**，或在命令行运行：

```bat
deploy.cmd                 :: 完整流程（含本地与服务器端测试）
deploy.cmd --skip-tests    :: 跳过测试，更快
```

其他系统使用 `npm run deploy` 或 `node scripts/deploy.mjs [--skip-tests] [--no-nginx]`。

一条命令完成：构建 CSS → 本地与服务器端单元测试 → 通过 SSH（`~/.ssh/config` 中的 `pku-cloud`）上传 → 切换版本 → 更新 `vigil.service` 与 nginx → 健康检查。任何一项检查失败都会**自动回滚**到上一版本（`~/vigil-inkpress.prev`）。部署后访问 **https://10.129.81.79:8443/vigil/**；`http://10.129.81.79/vigil` 会自动跳转到 HTTPS，因为口令加密备份、git-crypt 与剪贴板需要 HTTPS 安全上下文。主机、子路径、端口等可用环境变量覆盖，见 `scripts/deploy.mjs` 文件头。

子路径部署约定：

- 页面与脚本中的资源、`api/...` 中继地址一律使用**相对路径**；CSS 源模块仍写 `/assets/...`、`/fonts/...`（相对项目根），由 `npm run build:css` 在打包时换算为相对 `assets/vigil.css` 的路径，并拒绝引用不存在的文件。
- 由 `scripts/dev-server.mjs` 提供的页面会带 `<meta name="vigil-relay">`，因此在任何主机名下都使用同源 GitHub 中继；纯静态托管时仍浏览器直连 GitHub。
- 服务器上设置了 `VIGIL_PROXY_LOCK=1`：「本地网络与代理」指的是服务器本机，访客电脑上的 Clash 对服务器无效，所以页面不能修改代理设置，GitHub 请求始终由服务器直连。

## 主要功能

### 本地与 GitHub 文库并列

1. 进入「GitHub 仓库」连接现有仓库。公开仓库可以匿名只读；私有仓库或提交修改需要 Fine-grained PAT 的 **Contents: Read and write** 权限。
2. 连接成功后，自动切换到「全部手记 → GitHub 仓库」；本地手记与仓库手记为两个**同级文库**，不是把远端文件混进本地 JSON。
3. 在 GitHub 文库浏览目录、搜索当前文件夹中的 Markdown、打开文件阅读。阅读页与本地手记采用统一稿纸版式，点击「编辑手记」打开**完整的实时 / 阅读 / 源码三态编辑器**。新建 Markdown 也使用同一编辑器。
4. 输入后自动写入**本机草稿**，但只有点击「提交 GitHub」才写到远端。远端保存执行 SHA 冲突与 `.gitattributes`/git-crypt 规则校验，失败时保留尚未提交的本机草稿；不会偷偷回退为明文提交。仓库令牌仅存在页面内存，不写入 localStorage 或备份。

远端 Markdown 编辑**不是** GitHub ↔ 本地手记的自动同步，也不自动重命名文件：文件名取自仓库路径，正文 H1 可自由改写。匿名连接只读，可在仓库连接页提供临时 PAT 后再提交。

### Obsidian 风格的阅读与实时排版

新增 H4–H6 分级标题、普通引用段、Obsidian Callout（折叠 / 展开及嵌套），以及**受限的**字体 HTML 标记（`span`、`div`、`u`、`s`、`small`、`mark`）。既有 KaTeX 数学公式、表格、清单、链接与双向引用保留。

```markdown
#### 四级标题
##### 五级标题
###### 六级标题

> 普通引用
> 仍然是引用段落。

> [!note] 随手记
> 这是提醒内容。

> [!tip]+ 可展开的建议
> 使用标题和留白，把事情写清楚。

> [!question]- 默认折叠
> 点击标题才会显示内容。

<span class="font-kai" style="font-family: KaiTi; font-size: 18px">一字一句</span>

<div class="font-song" style="text-align: center">纸上有山川</div>
```

**安全限制：** 只允许有限的字体/字距/字号/文字色/对齐等 CSS 声明。脚本、事件回调、任意嵌入和外部样式表不会执行。不是完整 Obsidian CSS snippets 引擎；自定义类名可以保留，但未定义的类需要在项目主题 CSS 中配置。

### 品牌精简

侧栏顶部移除 `PRIVATE JOURNAL · 001`，品牌保留「不眠手记」和小一行副标题；桌面侧栏底部仅显示**左对齐的当前版本号**。手机侧栏缩为顶部，版本号不占用屏幕。

## 原有功能保留

- 本地全文检索、标签 / 收藏 / 待办筛选、日期归档、二十四节气与三候；
- Obsidian 风格单区域编辑器、KaTeX 实时数学渲染、右侧大纲、查找替换；
- 知识线索与行动清单、双向关联、回顾提示；
- 本机自动草稿、五份去重备份、JSON/口令加密备份；
- GitHub 仓库连接、Clash/HTTP/SOCKS5 本机代理、匿名诊断及 git-crypt 加密/解密；
- 深浅模式、主题色和自定义背景、侧栏折叠、毛玻璃与可关闭动效。

## 数据、安全与已知边界

- 正式本地手记仍使用 `vigil-mvp-data-v1`，草稿 `vigil-mvp-drafts-v1`，快照 `vigil-mvp-backups-v1`；**无需迁移或清除浏览器数据**。
- GitHub 编辑遵守 GitHub REST API 的 SHA 乐观锁。若远端已有新修改，请检查差异后再编辑；不能自动覆盖冲突。
- git-crypt 仍需用户合法导出的仓库密钥。不能把普通 JSON 口令加密备份当作 git-crypt 格式。
- 项目**没有**自动跨设备双向同步、完整 Obsidian 插件系统或任意 CSS 代码执行功能；原 v2.8.2 的数据迁移、存储 Schema 与加密格式兼容是明确的非目标。
- 真实私有仓库联网和写入需在你的网络环境中进行。浏览器 GitHub 读写自动化使用公开格式的模拟 REST API，不连接用户的真实账户。
- 源码 ZIP 不重复分发用户自备 TTF 字体；保留 `fonts/README.md` 和 `scripts/restore-fonts.py`。字体使用前请确认许可。

## 文档

- [使用指南](docs/USER-GUIDE.md)：各页面与编辑器的操作说明
- [GitHub 仓库与 git-crypt](docs/GITHUB.md)：连接、中继与代理、读写规则、故障排查
- [部署](docs/DEPLOY.md)：一键部署、服务器结构、HTTPS 与常见问题
- [架构](docs/ARCHITECTURE.md)：代码结构、样式模块、存储与加密备份
- [产品规格](docs/PRODUCT.md)：功能规划与实现状态
- [测试](docs/QA.md)：单元测试、浏览器回归与发布检查
- [更新日志](CHANGELOG.md)；原版应用的历史记录见 [docs/CHANGELOG-original.md](docs/CHANGELOG-original.md)

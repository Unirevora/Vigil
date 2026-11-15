# 不眠手记 · VIGIL Inkpress v1.5.0

以 **v1.1「铅字旧梦」** 的视觉系统为基底，保留深墨侧栏、朱砂红、旧宣纸、黄铜装饰与 CSS 打字机；在不破坏视觉辨识度的前提下微调圆角和信息层级。

v1.4 延续 v1.3 的标签、心情、收藏、GitHub 仓库、草稿与备份能力，并新增 **真正随输入更新的 Markdown 实时预览**、**廿四节气风物盘**、**三候／月相／节令短笺联动**和带节气标记的日历。

本项目不是单 HTML，基于原生 JavaScript ES Modules + 独立 CSS，**无需运行 npm install；CodeMirror 与 KaTeX 已随源码打包**。


## v1.5.0 · 玻璃墨痕（当前版本）

**产品定位：不是另一款只能写和保存的日记，而是能把私人文字变成可回溯行动与知识线索的本地工作台。**

在保留深墨绿侧栏、旧宣纸、朱砂印章、打字机静物、节气风物、三态 Markdown + KaTeX 的基础上：

- **Liquid Glass 悬浮控件**：高清山水底景上的胶囊快捷导航、搜索和悬浮操作。SVG `feDisplacementMap` + 独立场景采样/边缘法线 Canvas，曲面边缘折射、中心不变形；失败时降级磨砂高光。长文和编辑界面继续使用不透视的稳定纸面。
- **高清风物背景**：项目自带 3200×1801 水墨风物图与 2560×1441 深绿变体；保留梅枝/竹影/原打字机图片与用户自定义背景。
- **线索与行动**：从所有手记中汇总 `- [ ]` 任务、截止日期与完成状态；点击完成会写回原始 Markdown，并先创建安全快照。汇总 `[[手记标题]]` 关联与反向引用、缺失引用、高频标签、连续记录及本地周期回顾提示。
- **GitHub 连接自检**：基于 GitHub 官方 Contents API 检查仓库、分支、当前目录和 `.gitattributes`；继续支持 PAT 只在会话内存、Markdown 预览/编辑、SHA 冲突保护。
- **git-crypt 原生文件加解密**：支持 `git-crypt export-key` 二进制对称密钥；识别 `\0GITCRYPT\0` 文件头、AES-256-CTR 与 HMAC-SHA1 检查。仓库中的受保护 `.md` 可解锁预览、编辑后重新加密提交。还提供「门与数据」本地文件工坊。密钥从不上传或持久化。
- **保留** v1.4.2 三态 CodeMirror 同窗编辑、KaTeX 数学公式、标签心情收藏、月历/节气、JSON 口令备份、折叠导航与回弹。

**兼容性与验证边界：** 本次通过 68 项 Node 测试、21 项浏览器交互检查和六种屏幕宽度的布局检查，含模拟 GitHub Contents API 提交；不能声称已经连接你的私人仓库，也未用实际原生 git-crypt CLI 输出的密文/密钥做端到端互操作测试。复杂 Git 属性规则和旧 v2.8.2 加密迁移需真实仓库/原始样本核验。原设计 P2 中的完整四语言热切换、笔画重组和复杂 3D 动画仍未实现，不以伪功能冒充完成。

主要文档：[液态玻璃规范](docs/LIQUID-GLASS-1.5.md) · [git-crypt 安全指南](docs/GIT-CRYPT-1.5.md) · [产品价值与线索工作台](docs/PRODUCT-STRATEGY-1.5.md) · [功能覆盖状态](docs/IMPLEMENTATION.md) · [QA 验证](docs/QA-1.5.md)。

项目不是单 HTML，源码使用原生 ESM，内置 KaTeX、CodeMirror 与高清背景资源。运行前无需从网络下载前端依赖：

```bash
npm run dev
```

打开 `http://127.0.0.1:5173/`。单元测试执行 `npm test`。请使用 localhost 或 HTTPS 以启用 Web Crypto；不要直接双击 HTML 文件。

---

## v1.4.2 · 一纸三观（历史版本）

这次不是换风格，而是对 **v1.4.1 墨绿文房** 的功能性重构。侧栏、梅花、远山、旧宣纸、打字机素材与轻盈回弹继续保留。

实际 Chromium 页面预览：[实时渲染](docs/preview-142-live.png) · [阅读模式](docs/preview-142-reading.png) · [源码模式](docs/preview-142-source.png) · [外观工坊](docs/preview-142-settings.png) · [沉浸书写](docs/preview-142-zen.png) · [手机编辑](docs/preview-142-mobile-editor.png)。

### 1. 单窗三态 Markdown 编辑器

写作界面不再左右分栏。同一张纸内切换 **实时渲染 / 阅读模式 / 源码模式**：

- 实时模式：光标所在行保留 Markdown 源码，离开编辑的行显示标题、强调、公式、任务清单和表格等排版；编辑器由 CodeMirror 维护光标、IME 和撤销历史。
- 阅读模式：同一纸面变成只读排版，不离开写作页；源码模式：完全展示 Markdown 原文及高亮。
- 本地 KaTeX 0.16.27 支持 `$...$`、`\(...\)`、`$$...$$` 与 `\[...\]`；采用 MathML 输出，没有外部 CDN 依赖，也不捆绑公式字体。
- 支持 `[[手记标题]]` 内部关联、任务清单勾选、表格、数学公式工具栏、`Ctrl/⌘+F/H` 查找替换、沉浸书写。
- 写作中 `Ctrl/⌘+E` 切换实时/阅读，`Ctrl/⌘+S` 正式存档；切换模式不会改变存储的正文字符串。

这是一套接近 Obsidian Live Preview 的实现，**不是 Obsidian 所有 Markdown 语法的逐 token 完整克隆**。

### 2. 外观工坊

- 顶栏齿轮或侧栏「外观设置」。
- 六种主题色预设、自定义颜色、浅纸/墨夜切换。
- 旧宣纸、远山、疏梅、竹影、海波与纯净素笺；支持上传本机图片作为全局背景。
- 首页打字机静物可以保留原画，也可以换成你上传的案头照片。
- 正文字号、行距、画布宽度、字体风格、纸面颗粒、背景与遮罩透明度。
- 图片自动转 WebP 并存入 IndexedDB，不占原有 localStorage 手记容量。
- 外观、图片和编辑模式偏好与正式手记库分开存储；恢复经典外观不删除任何手记。

详细说明：[单窗编辑器](docs/EDITOR-1.4.2.md) · [外观工坊](docs/APPEARANCE-1.4.2.md) · [变更记录](CHANGELOG.md)

## v1.4.1 新增功能

不改变 v1.4.0 墨绿文房的整体画风，新增了交互与数据能力：

- **桌面侧边栏折叠**：点侧栏与正文交界处的图标，把侧栏缩至约 79px；六个一级入口保持可操作。折叠状态保存在当前浏览器中，刷新后保留。
- **手机导航折叠**：点右上角菜单图标收起/展开六个入口。进入页面后自动收起，减少滚动前的无用空间；手机展开状态与桌面折叠状态互不干扰。
- **轻盈回弹动画**：按钮按压、悬浮纸卡、导航反馈、弹窗落纸、页面内容依次浮现，以及打字机静物的极轻呼吸。减少动态效果的系统设置下自动停用。
- **Ctrl/⌘ + K 快速命令面板**：搜索本地手记标题/正文/标签，打开页面、新建手记、继续草稿、筛选收藏；Esc 关闭、上下键选择、Enter 执行。
- **口令加密导出/导入（P1-09 部分）**：在「门与数据」页面中导出 `.vigil.json`，使用 AES-256-GCM + PBKDF2-SHA256。口令只在本次操作使用，解密导入仍需确认并先尝试建立安全备份。

> 这个加密文件是 **v1.4.1 新设计的独立格式**，并非原项目 v2.8.2 的旧加密文件迁移器。旧格式未核实，不能直接当作兼容格式使用。公式 KaTeX（P1-10）仍在待办清单。

[动效与快捷键说明](docs/MOTION-AND-COMMANDS.md) · [加密备份格式与恢复指南](docs/ENCRYPTED-BACKUP.md)

## v1.4 参考图 UI 落地（非单张效果图）

本轮基于你提供的那张 **深绿侧栏 + 宣纸画布 + 真实打字机/铜灯/梅枝静物** 的截图，直接改了网站项目：

- 首页顶部的构图与边距按参考图重排，复古标题、真实按钮、导航、手记统计、节气跳转和最近手记仍是 HTML/CSS/JS 组件；
- 只将用户上传截图中**右侧的静物插画区域**裁成 `assets/typewriter-still-life.webp` 作为装饰资源（不是将整张网站截图铺到页面上）；图片里示范性纸张文字属于装饰画面，实际手记依旧以首页列表/阅读页和数据存储为准；
- `assets/paper-fibers.webp` 生成轻微纸张纤维质感，另外提取少量不含功能文字的山水、梅枝、波纹、竹叶装饰；
- 恢复朱砂印、深墨绿侧栏、黄铜细线、印刷纸张、几何切角的导航项；
- 桌面端以参考图约 1672×941 的构图比例为目标，移动端改为纵向主视觉；
- 其余手记、编辑器、GitHub、日历、风物盘和数据管理也统一纸张、边框、字体、按钮层级；
- 保留 v1.3 所有已有功能，并补充参考图页面的浏览器回归检查。

本轮 UI 样式集中在 **`src/styles/inkpress-reference.css`**，不会把整个站点压成一个 HTML 文件。

注意：插画素材改编自你提供的参考截图，请仅在你拥有相应使用权的场景发布。

## 参考图落地后的实际浏览器预览

- [桌面首页](docs/preview-home.png)
- [手机首页](docs/preview-mobile.png)
- [Markdown 实时编辑器](docs/preview-editor.png)
- [节气风物盘](docs/preview-almanac.png)
- [节气标注日历](docs/preview-calendar.png)
- [GitHub 仓库工作区](docs/preview-github.png)

这些图来自真实 Chromium 页面截图，而不是生成的网页效果图。

## 快速运行

需要 Node.js ≥18：

```bash
npm run dev
```

在浏览器打开 `http://127.0.0.1:5173/`。

也可使用 Python 3：

```bash
python3 -m http.server 5173
```

原生 ES Modules 需要 HTTP 服务，请勿直接双击 `index.html` 使用 `file://`。

运行单元测试：

```bash
npm test
```

## 核心功能

| 页面 | 功能 |
| --- | --- |
| 首页 | 1.1 打字机视觉、最近手记、手记统计、今日节令、继续草稿 |
| 全部手记 | 搜索、日期排序、标签／收藏筛选 |
| 写作 | **单窗实时/阅读/源码三模式**、CodeMirror、KaTeX、表格、任务清单、关联手记、查找替换、沉浸模式 |
| 阅读 | Markdown、KaTeX 数学公式、表格与任务清单、内部关联、收藏、上一篇／下一篇 |
| 日历与归档 | 月历、节气日期、手记圆点、选日详情、月份归档、往年今日 |
| 节气风物 | 24 节气轮盘、拖动/触摸/滚轮/键盘预览、三候/月相/短笺，预览静置后回到今天 |
| GitHub 仓库 | 公开仓库匿名浏览；使用临时令牌访问私有仓库、预览与提交 Markdown 文件 |
| 门与数据 | 本地草稿、JSON 明文/口令加密导入导出、最多五份本地备份与历史恢复 |
| 外观设置 | 背景、自选图片、主题色、字体、行距、纸面配置 |

### Markdown 与 KaTeX

- v1.4.2 已将旧左右双栏改成**一张稿纸、三种模式**。当前行按 Markdown 原文输入，其余行按需格式化。
- 公式由本地 KaTeX 真正解析并输出 MathML；不采用静态图片或 CSS 假公式。
- CodeMirror 保管唯一源码和撤销历史；阅读模式只展示格式化结果。
- Markdown 包含标题、强调、任务列表、表格、代码、引用、链接、内部 `[[手记标题]]` 链接。
- 用户输入中的 HTML 不会作为脚本执行；数学排版禁用 `trust`。详细范围及复杂语法限制见 `docs/EDITOR-1.4.2.md`。

### 廿四节气、三候与风物

- 完整的 24 个节气名称与经典 72 候词条，每节气三候。
- 根据太阳视黄经（每隔 15°）估算节气开始时刻，以**北京时间 UTC+8**对应的公历日呈现。
- 节气盘支持鼠标拖动、触摸拖动、鼠标滚轮、点击节气名、左右键逐日、PageUp/PageDown 跨节气、Esc/Home 回今天。
- 预览静置约 3 秒后回到今天；尊重系统 `prefers-reduced-motion`。
- 节气、三候、月相与原创节令短句联动；月相是**朔望周期近似估计，不是精密天文历表**。
- 日历每个节气日期使用朱砂标记，普通手记以墨点标记；选日期可查看当天记录并跳转风物。
- 参考：香港天文台 [二十四节气](https://www.hko.gov.hk/en/gts/time/24solarterms.htm)、[节气时刻说明](https://www.hko.gov.hk/en/gts/astronomy/Solar_Term.htm)。
- **2026 关键节气日期**在自动化测试中与公开历表日期对齐；如需精确到分秒应以权威天文台资料为准。

## 你自备的两套字体

项目 CSS 已正确引用：

```text
fonts/titlefont.ttf  # VIGIL 标题字体
fonts/textfont.ttf   # VIGIL 正文字体
```

**当前源码 ZIP 不直接分发字体二进制文件。** 你可以在本机用自己的原始项目包快速恢复字体：

```bash
python3 scripts/restore-fonts.py /path/to/vigil-rebuild.zip
```

如果要在你的电脑上把源码与这两套自有字体重新打成一个完整 ZIP：

```bash
python3 scripts/pack-with-local-fonts.py /path/to/vigil-rebuild.zip
```

生成 `vigil-inkpress-with-local-fonts.zip`。不联网、不下载，仅读取你已经持有的原始 ZIP。详见 [`fonts/README.md`](fonts/README.md)。

## GitHub 仓库工作区

不需要在 ChatGPT 里关联账号。启动软件后进入「GitHub 仓库」，输入已有仓库 URL：

```text
https://github.com/owner/repo
```

可指定分支和 Markdown 所在子目录。公开仓库不必填写 Token 即可读取；编辑私有/公开仓库时需要 GitHub fine-grained PAT，授权目标仓库 `Contents: Read and write`。

- Token **只在当前网页的 JavaScript 内存中**，不会写入浏览器本地存储；刷新后需重新提供。
- 编辑时携带文件 SHA，GitHub 409 冲突时停止提交并保留编辑框内容。
- 当前不提供账号 OAuth 登录，也不进行 GitHub ↔ 本地文库自动双向同步。
- **本项目的 GitHub 提交流程已用模拟 API 测试，未操作你的真实仓库。**

详细权限与使用说明见 [`docs/GITHUB.md`](docs/GITHUB.md)。

## 本地数据安全

- 正式条目：`vigil-mvp-data-v1`（兼容上一版原型 Schema v1，包括新增的可选标签、心情、收藏字段）。
- 草稿：`vigil-mvp-drafts-v1`；输入后约 650ms 自动保存，切换页面前再尝试保存。
- 备份：`vigil-mvp-backups-v1`；每次正式保存生成快照，最多五份；删除/导入/恢复前尝试安全快照。
- 当前浏览器的本地备份**不是异地备份**，清理浏览器缓存可能一起删除所有数据，请定期导出 JSON。
- 旧完整项目 v2.8.2 的真实数据迁移、旧版加密 JSON 与服务端私密入口并未验证，不可声称兼容。

## 项目结构

```text
index.html
src/
  main.js
  core/                entries.js, calendar.js, almanac.js, markdown.js, math.js, format.js
  storage/             repository.js, schema.js, drafts.js, backups.js,
                       transfer.js, encrypted-transfer.js
  github/api.js
  ui/
    views/             home.js, editor.js, reader.js, entries.js,
                       calendar.js, almanac.js, github.js, data.js, settings.js
    almanac-controller.js
    feedback.js, passphrase.js, command-palette.js, motion.js
    icons.js
  styles/              foundation.css, layout.css, controls.css, pages.css,
                       typewriter.css, almanac.css, heritage.css,
                       live-editor.css, responsive.css, inkpress-reference.css,
                       motion-141.css, editor-142.css, appearance-142.css
  editor/              unified-editor.js
  appearance/          settings.js, background.js
vendor/                 CodeMirror 5, KaTeX ESM（本地库，不含字体二进制）
tests/
scripts/
fonts/
assets/
docs/
```

## 开发依据与变更说明

- [`docs/MVP.md`](docs/MVP.md)：用户之前整理的 P0/P1/P2 规格，保留原文。
- [`docs/CHANGELOG-original.md`](docs/CHANGELOG-original.md)：原项目更新日志，保留原文。
- [`docs/SOURCE-ALIGNMENT.md`](docs/SOURCE-ALIGNMENT.md)：为什么从 P2 恢复节气盘和实时预览。
- [`docs/ALMANAC.md`](docs/ALMANAC.md)：计算与交互边界。
- [`docs/DESIGN-SYSTEM.md`](docs/DESIGN-SYSTEM.md)：1.1 风格继承清单与颜色体系。
- [`CHANGELOG.md`](CHANGELOG.md)：当前 v1.4.2 更新内容。
- [`docs/EDITOR-1.4.2.md`](docs/EDITOR-1.4.2.md)：单窗编辑器、KaTeX、键盘快捷键。
- [`docs/APPEARANCE-1.4.2.md`](docs/APPEARANCE-1.4.2.md)：主题、背景上传与本地持久化。
- [`docs/QA-1.4.2.md`](docs/QA-1.4.2.md)：本次验证与待测项。
- [`docs/MOTION-AND-COMMANDS.md`](docs/MOTION-AND-COMMANDS.md)：回弹动效、折叠侧栏与快捷命令。
- [`docs/ENCRYPTED-BACKUP.md`](docs/ENCRYPTED-BACKUP.md)：新加密文件结构与数据保护边界。
- [`docs/RELEASE-QA-1.4.1.md`](docs/RELEASE-QA-1.4.1.md)：测试和发布核对。

### 暂缓范围

旧站 v2.8.2 的真实加密格式迁移、跨设备自动同步、GitHub OAuth、极复杂 Markdown 的完全兼容、3D 纸面动画、诗词笔画分片动画及多语言实时热切换。**KaTeX 实时渲染与同窗三态已在本版完成**。

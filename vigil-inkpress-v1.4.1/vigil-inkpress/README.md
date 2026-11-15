# 不眠手记 · VIGIL Inkpress 1.4.1

以 **v1.1「铅字旧梦」** 的视觉系统为基底，保留深墨侧栏、朱砂红、旧宣纸、黄铜装饰与 CSS 打字机；在不破坏视觉辨识度的前提下微调圆角和信息层级。

v1.4 延续 v1.3 的标签、心情、收藏、GitHub 仓库、草稿与备份能力，并新增 **真正随输入更新的 Markdown 实时预览**、**廿四节气风物盘**、**三候／月相／节令短笺联动**和带节气标记的日历。

本项目不是单 HTML，基于原生 JavaScript ES Modules + 独立 CSS，**零第三方运行依赖**。


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
| 写作 | 标题、日期、标签、心情、Markdown 快捷工具；**左右源码／实时预览**，移动端上下排列 |
| 阅读 | 安全的基础 Markdown、收藏、上一篇／下一篇 |
| 日历与归档 | 月历、节气日期、手记圆点、选日详情、月份归档、往年今日 |
| 节气风物 | 24 节气轮盘、拖动/触摸/滚轮/键盘预览、三候/月相/短笺，预览静置后回到今天 |
| GitHub 仓库 | 公开仓库匿名浏览；使用临时令牌访问私有仓库、预览与提交 Markdown 文件 |
| 门与数据 | 本地草稿、JSON 明文/口令加密导入导出、最多五份本地备份与历史恢复 |

### Markdown 实时预览

- 写作页左侧始终是原始 Markdown 文本，右侧是安全渲染的预览。
- 输入后在下一次绘制帧更新，不需要点击「预览」切换；不会重建 textarea，因此光标、中文输入、选择和撤销操作保持独立。
- 两个滚动区域按比例联动。手机上排列为上下两块。
- 「专注书写」可暂时折叠预览，不影响草稿与正式保存。
- 对原始 Markdown 中的 HTML 标签进行转义，拒绝危险链接协议。
- 当前基础解析器支持标题、强调、列表、引用、链接、代码、分隔线；复杂 CommonMark 和 KaTeX 公式仍待扩展。**不是 Obsidian 的 token 级内联源码/预览混排**。

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
  core/                entries.js, calendar.js, almanac.js, markdown.js, format.js
  storage/             repository.js, schema.js, drafts.js, backups.js,
                       transfer.js, encrypted-transfer.js
  github/api.js
  ui/
    views/             home.js, editor.js, reader.js, entries.js,
                       calendar.js, almanac.js, github.js, data.js
    almanac-controller.js
    feedback.js, passphrase.js, command-palette.js, motion.js
    icons.js
  styles/              foundation.css, layout.css, controls.css, pages.css,
                       typewriter.css, almanac.css, heritage.css,
                       live-editor.css, responsive.css, inkpress-reference.css,
                       motion-141.css
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
- [`CHANGELOG.md`](CHANGELOG.md)：当前 v1.4.1 更新内容。
- [`docs/MOTION-AND-COMMANDS.md`](docs/MOTION-AND-COMMANDS.md)：回弹动效、折叠侧栏与快捷命令。
- [`docs/ENCRYPTED-BACKUP.md`](docs/ENCRYPTED-BACKUP.md)：新加密文件结构与数据保护边界。
- [`docs/RELEASE-QA-1.4.1.md`](docs/RELEASE-QA-1.4.1.md)：测试和发布核对。

### 暂缓范围

旧站真实加密格式迁移、公式 KaTeX、跨设备同步、OAuth 登录、token 级同位预览、复杂 3D 纸面动画以及用户没有再次要求的完整诗词笔画分片动画。

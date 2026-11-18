# 测试与验收 · 不眠手记 VIGIL Inkpress

> 本文合并并取代 `RELEASE-QA-1.4.1.md` 与全部 `QA-*.md`。只保留当前的测试方式、各版本验收要点与仍然有效的已知限制；逐步操作日志与截图清单已删除。架构见 `ARCHITECTURE.md`，部署见 `DEPLOY.md`。

## 1. 测试分层

| 层 | 命令 | 覆盖 | 依赖 |
| --- | --- | --- | --- |
| 单元 / 集成 | `npm test`（即 `node --test tests/*.test.js`） | 数据层、Markdown 与安全渲染、编辑器逻辑、加密、git-crypt、GitHub 客户端与中继、CSS 契约、版本一致性 | Node.js 18+，无 npm 依赖 |
| 浏览器回归 | `python scripts/qa-browser.py` | 离线 Chromium 端到端操作，模拟 GitHub API | Python Playwright + Chromium |
| 网络诊断 | `npm run diagnose:github`（另一终端先 `npm run dev`） | 本地服务、代理、上游 JSON、公开仓库信息与目录、备用同源通道 | 可访问 GitHub 的网络 |
| 部署健康检查 | `deploy.cmd` / `npm run deploy` | 构建、本地与服务器测试、上线后 9 项检查，失败自动回滚 | SSH 主机与服务器 sudo |

### 1.1 Node 单元测试（`tests/`）

使用内置 `node:test`，不需要安装依赖。按主题划分：

- **数据**：`storage`、`drafts`、`backups`、`core`、`features`——Schema v1 校验、损坏数据只读保护、草稿隔离、快照上限与去重、筛选与任务识别。
- **加密**：`encrypted-transfer`——中文 / emoji 往返、随机盐与 IV、错误口令、密文篡改、版本 / 算法不符、短口令、非法 Base64。
- **git-crypt**：`git-crypt`、`github-git-crypt`——密钥文件解析、与独立 OpenSSL AES-CTR/HMAC-SHA1 结果逐字节一致、错误密钥与篡改拒绝、`.gitattributes` 规则与提交前拦截。
- **Markdown / 编辑器**：`math-142`、`editor-refine`、`release-170`、`editor-scroll-stability`——KaTeX、实时装饰范围、换行、H1–H6、Callout、白名单 HTML；`decorateNow` 选区命中用 for 循环（早退），`findNext` 大小写缓存。
- **GitHub 与网络**：`github*`、`hotfix-network-155`、`repair-155-integration`——SHA 写入与冲突、匿名 / 令牌隔离、连接三阶段、备用通道、浏览器链路诊断、fetch 生命周期、HTTP CONNECT 与 SOCKS5（本地模拟 TLS 上游，临时 CA 不随项目交付）、诊断 CLI。
- **界面契约**：`ui-reference`、`appearance-*`、`chronicle-154`、`release-15x`、`release-171`、`release-173`、`visual-polish-176`、`release-177`、`tab-indicator`、`subpath-deploy`——读取 CSS 与视图源码，检查统一标签、器透纸温与毛玻璃范围、夜间墨玉罗盘与单色源、编年分卷眉与卷首卡、竖排书耳与节气签、精微字法与铅印栏花、大纲行为、落笔退隐与展信转场、子路径与 CSS 地址换算、代理锁、`package.json` / 侧栏 / 关于页 / 诊断的版本号一致。

CSS 契约测试应通过 `tests/support/styles.js` 读取样式：`readStyles()` 按 `scripts/style-order.json` 顺序拼接全部模块，`readStyle('tabs')` 读取单个功能模块。

`settings-layout.test.js` 检查四类设置的归属与唯一入口、两个特效强度的统一禁用状态，以及旧设置控件和标签规则不再出现。设置界面验收覆盖外观 / 排版 / 数据 / 关于的深浅主题、四栏键盘导航、上传与恢复图片、偏好热切换及刷新保存；确认操作前后正式手记原文不变。

设置滚动检查：在内容面板内滚轮与键盘滚动，标题与标签位置不变，文档本身不滚动；缩放窗口、展开移动导航后重新适配。导入/导出卡片在桌面等高、按钮底部对齐，窄屏纵向排列；点击操作仍走原导出与导入校验流程。

`motion-175.test.js` 检查全局浮动的偏好持久化与保存失败保护、角度边界，以及点阵帷幕的像素预算、相同设置不重启、后台/关闭/销毁后的调度清理。浏览器验收需同时开启浮动与帷幕，检查侧栏和顶栏不倾斜、嵌套面板只倾斜一次、开关与动效偏好即时生效；采样工具栏过渡的中间位置，并核对菜单半透明底色、实际模糊和减少透明度的回退。性能数字应区分 Canvas 回调耗时与整页合成耗时，不推断为所有设备帧率。

浮动回归必须包括百篇以上列表和数百节长手记：在最高幅度下移动至视口四角、滚动至文档中段与末尾，核对投影尺寸与原始布局尺寸接近、无横向溢出；窗口和内容高度变化后应重测，不能只用短文验证。

样式已按功能模块组织。界面契约测试统一通过 `tests/support/styles.js` 读取并按规则内容断言，不再按 `inkpress-reference.css`、`vigil-156.css` 等旧文件名判断样式是否存在。

### 1.2 浏览器回归（`scripts/qa-browser.py`）

```bash
pip install playwright
python -m playwright install chromium
python scripts/qa-browser.py                 # 默认不写任何文件
VIGIL_QA_SHOTS=out python scripts/qa-browser.py   # 需要截图时指定目录
```

- 把 `src/main.js` 的真实模块依赖与 `assets/vigil.css` 内联装配为离线页面，再用 Playwright 驱动 Chromium；GitHub API 由确定性的假 `fetch` 响应代替，**从不使用真实令牌或网络**。
- 在 1440 px 与 390 px 两种宽度下检查：应用加载；两个文库页签与未连接引导；连接后回到全部手记并显示仓库目录；共享阅读页渲染 Callout 与 H4；共享三态编辑器；SHA 提交与远端内容刷新；新建远端手记首次 PUT 不带 SHA；409 冲突保留本机草稿；无横向溢出；无运行时 JS 错误。
- 修改了 CSS 后先 `npm run build:css`，因为脚本读取的是生成后的 bundle。
- 这是离线夹具，不等于在 localhost / HTTPS 下的真实 ES Modules 加载与安全上下文验证。

### 1.3 部署健康检查

`scripts/deploy.mjs` 先在本地检查字体、构建 CSS、运行单元测试，上传后在服务器上再跑一次测试，切换版本后通过 nginx 检查：页面 200、样式表 200、主程序 200、中继自检 200、跨站 POST 被拒 403、代理设置已锁定 409、HTTP→HTTPS 跳转 301、页面带 `vigil-relay` 标记；服务器能否访问 GitHub API 只提示、不阻断。任一必检项失败自动回滚到上一版本。

### 1.4 发布前手动验收

在真实浏览器、`npm run dev` 或 HTTPS 部署下：

1. 先在「设置 → 数据」导出 JSON 或加密备份。
2. 确认已有手记仍在；新建、编辑、保存、阅读、删除一篇。
3. 加密导出后再导入（需要安全上下文）。
4. 上传自定义背景，刷新后仍在（IndexedDB）。
5. 用自己的 Fine-grained PAT 连接仓库：浏览、阅读、编辑并提交，核对 GitHub 上的提交；加密仓库额外测试 export-key 解锁。
6. 中文输入法长段落输入、撤销；切换深浅主题与减少动态效果。

### 1.5 编写与报告约定

- 新功能同时补单元测试；涉及数据写入的，必须包含「损坏 / 拒绝时不改动现有数据」的负面用例。
- 网络相关测试使用本地 HTTP 服务器与伪造上游，不访问 `api.github.com`；令牌一律使用无效测试字符串。
- 安全相关断言包括：令牌与密钥不写入存储、带令牌请求与 PUT 不切换通道或重试、诊断输出不含正文、仓库路径或令牌。
- 截图只在需要时生成，不再随发布包提交历次 QA 截图。
- 记录结果时区分「离线夹具通过」「本地 Node 服务 HTTP 验证」「真实网络 / 真实账户验证」，不得互相替代。

## 2. 历史验收要点

| 版本 | 已验证 | 未覆盖的边界 |
| --- | --- | --- |
| 1.4.1 | 加密备份往返与负面用例；侧栏 79 px 折叠与偏好记忆；Ctrl/⌘+K；口令弹窗 Esc 清空；320–1672 px 无溢出；减少动效 | 离线页面无 `crypto.subtle`，浏览器端加密导出未端到端验收 |
| 1.4.2 | 三态编辑器源码与撤销历史不变、查找替换、公式与任务、外观持久化；开发服务器 `.mjs`/`.webp` MIME | 自定义背景 IndexedDB 真实 Origin 上传闭环 |
| 1.5 | git-crypt 与 OpenSSL 逐字节一致；GitHub mock 读写含 SHA、Token 不落盘；任务回写；玻璃 Canvas 采样；修复手机侧栏按钮溢出 | 原生 git-crypt CLI 文件、复杂 `.gitattributes` 规则、真实仓库 |
| 1.5.1 | 实时模式活动行标记与排版并存、行内 / 块级 MathML、阅读无空段、软换行、大纲跳转 | 真实输入法与超长文档性能；Safari / Firefox MathML 与玻璃降级 |
| 1.5.2 | 格式工具、右侧大纲展开收起、设置页签、移动端遮罩关闭大纲 | 同上 |
| 1.5.3 | 主题色派生侧栏、经典墨色切换、夜间玻璃对比、关闭动效、自绘下拉键盘操作；下拉浮层不出视口 | Safari / Firefox 着色玻璃与无 `backdrop-filter` 设备 |
| 1.5.4 | 日历 / 节气合页与日期双向同步、五个设置页签、关于页与本地诊断不泄露内容、桌面无底部 Dock | 安全上下文、真实 ESM 加载、真实 GitHub 与 git-crypt |
| 1.5.5 | 每页唯一主标题、顶栏不重复页面名、近七天 / 未完成任务筛选、导出当前结果、`/` 快捷键；夜间中性石墨侧栏、印记与 favicon、点阵帷幕开关与暂停 | Safari / Firefox Canvas 性能；真实 `api.github.com`（环境 DNS 不可用） |
| 1.5.6 | 夜间统计 / 回顾卡对比、顶栏透明；CSS 单文件 bundle；快照去重；本地服务各资源 200；中继代理（HTTP CONNECT / SOCKS5）、Clash 7897、连接三阶段、备用同源通道、fetch 生命周期等热修复 | 真实 Chromium localhost 页面（环境阻断）；用户本机 Clash 与私有仓库 |
| 1.7.0 | 双文库页签、远端目录与搜索、共享阅读与三态编辑器、SHA 提交与 409 保留草稿、新建远端 Markdown、H1–H6 / Callout / 字体 HTML、390 与 1440 px | 真实 GitHub 读写、组织权限、代理节点、原生 git-crypt 互操作 |
| 1.7.1 | 统一标签样式、毛玻璃范围与稿纸不透明、编辑工具并入属性行、等高大纲侧栏、版本号一致；子路径部署、CSS 地址换算、中继识别、代理锁；部署健康检查 | Safari 自签证书 HTTPS 下的完整手动回归 |

历次浏览器检查覆盖 320 / 390 / 768–810 / 1024 / 1440 / 1672 px 与日夜两套主题，均要求无横向溢出、无运行时 JS 错误。1.4.1 – 1.7.0 的浏览器测试都在离线内联夹具中进行（测试环境的 Chromium 访问 localhost 被策略阻断），从未把夹具结果当作真实连接成功。

## 3. 仍然有效的已知限制

**未经验证、不得宣称：**

- 真实私有仓库的 PAT / 组织权限 / SSO、真实提交与冲突场景；浏览器自动化只使用模拟 API。
- 原生 `git-crypt` CLI 生成文件的互操作，需要用户合法的仓库与 export-key；复杂 `.gitattributes` 规则会被拒绝自动提交，应以本地 `git check-attr` 核对。
- 用户本机代理（Clash / SOCKS5）到 GitHub 的实际连通。

**环境依赖：**

- 加密备份、git-crypt、剪贴板需要 HTTPS 或 localhost。
- 毛玻璃与 SVG 位移在 Safari / Firefox 中合成效果不同；不支持 `backdrop-filter` 或开启「减少透明度」时回退实色。
- 自定义背景受浏览器 IndexedDB 配额限制，未做大文件压力测试。
- 节气与月相为近似计算，不能替代天文台数据。

**功能边界：**

- 原 v2.8.2 的数据迁移、存储 Schema 与加密文件兼容均为非目标；当前导入口径只支持本项目 Schema v1 与独立加密备份格式。
- 远端文件不能重命名，GitHub 文库不自动镜像为本地手记，没有自动双向同步或 OAuth。
- Obsidian 兼容受白名单约束，不运行社区 CSS snippet 或插件。
- 本地快照不能防止浏览器数据被清除；用户应定期导出备份并做恢复演练。
- 用户自备字体（`titlefont.ttf`、`textfont.ttf`）不随源码分发；缺失时回退系统字体，可用 `scripts/restore-fonts.py` 恢复。

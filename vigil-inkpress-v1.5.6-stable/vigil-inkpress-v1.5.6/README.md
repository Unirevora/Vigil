# 不眠手记 · VIGIL Inkpress v1.5.6

> 墨夜归整：复古文房与液态玻璃写作工作台。此版本重点修复夜间模式、顶栏视觉、GitHub 本地网络链路，并降低发布体积。

## 本版修复

- **夜间可读性**：统一石墨色卡片与亮色墨字，修复统计数字、周回顾、待办、笔记日期、标签等文字在深色背景上的低对比度。
- **顶栏去遮罩**：整条顶栏不再显示固定背景或暗色条，仅保留设置、搜索、日期和主题切换等独立操作。
- **更轻的运行加载**：24 份原始 CSS 样式按清单构建为 `assets/vigil.css`，浏览器只请求一份；源码仍为多模块。
- **背景压缩**：晴岚、月汐保留 1672×941 像素分辨率，改为 WebP；旧版本截图不再进入正式项目包。
- **安全存储**：保持手记、草稿、备份与外观设置的原存储键。内容完全相同的备份不再重复创建；数据页新增本地容量估算。
- **GitHub 网络提示**：本地同源转发支持 `HTTPS_PROXY`（HTTP/HTTPS 代理）及 `NO_PROXY`；区分代理隧道失败、DNS、超时和权限错误。带副作用的 PUT 提交失败时不自动重试。

完整说明：[结构与存储](docs/STRUCTURE-1.5.6.md) · [修复 QA 与限制](docs/QA-1.5.6.md) · [历史更新日志](CHANGELOG.md)。

## 启动

需要 Node.js 18 或更新版本。无需执行 `npm install`，项目本身无第三方 Node 运行依赖：

```bash
npm run dev
```

打开 `http://127.0.0.1:5173/`。该命令会先合并 CSS，再启动本地开发服务器。修改样式后需要重新运行 `npm run build:css`（或重新启动）。

运行测试：

```bash
npm test
```

## GitHub 连接仍失败时

1. 请使用 `npm run dev` 而不是用 `file://` 双击 HTML，浏览器访问 `http://127.0.0.1:5173/`。
2. 打开「GitHub 仓库」并点击 **测试 GitHub 网络**（不需要 Token）。
3. `http://127.0.0.1:5173/api/github/health` 应返回 `{ "ok": true }`；**这只确认本地服务可用，不代表 GitHub 外网已可访问**。
4. 若错误含 `EAI_AGAIN` / `ENOTFOUND`，检查 DNS；`PROXY_CONNECT_407` 检查代理认证；`TIMEOUT` 检查网络出口和防火墙。
5. 如需经过 HTTP(S) 代理启动 Node：

   ```bash
   HTTPS_PROXY=http://127.0.0.1:7890 npm run dev
   ```

   将地址和端口替换为本机真实代理。该变量只用于 Node 到 GitHub 官方 `api.github.com` 的 HTTPS 隧道；应用不提供任意目标 URL 的通用代理。

公开仓库只读无需令牌。私有仓库或提交需要相应 Contents 权限的临时 PAT；Token 仅保留在当前网页会话内存中，不会被备份。`git-crypt` 仓库还需要正确的导出密钥文件，不能与本地加密 JSON 口令混用。

**外部验证边界**：本次执行环境的 Chromium 策略禁止访问 localhost URL，GitHub 公共网络也可能受 DNS 限制；真实个人 GitHub 仓库读写无法在此完成。项目的 Node 本地 HTTP 服务和受限转发模拟测试已执行，详见 QA 记录。

## 已保留的功能

- 同一编辑器内的 Markdown 实时排版、阅读和源码模式，KaTeX 公式、表格、任务清单、右侧大纲。
- 时间日历、二十四节气、三候、风物短笺。
- 本地全文搜索、标签/收藏/待办筛选、往年今日、知识双向关联与一周回顾。
- 自动草稿、最多五份本地备份、JSON 导入导出、AES-GCM 加密备份。
- GitHub Markdown 仓库预览、编辑、SHA 冲突保护及 git-crypt 兼容模块。
- 日/夜主题、自定义主色、可折叠侧边栏、毛玻璃控制、背景上传和可选点阵帷幕。

## 存储与隐私

- 正式手记：`vigil-mvp-data-v1`；独立草稿：`vigil-mvp-drafts-v1`；备份：`vigil-mvp-backups-v1`。
- 外观配置：`vigil-appearance-v142`；自定义背景图片以 IndexedDB Blob 存储。
- **本版不要求数据库迁移，不主动清理任何用户浏览器数据**。本地浏览器快照不等于异地备份，请定期导出 JSON 或口令加密文件。
- 图片和字体需遵守各自授权。本源码 ZIP 不附带用户自备的 TTF 文件；如需在自己设备上恢复字体，使用 `scripts/restore-fonts.py`。

## 主要结构

```text
index.html                    # 多模块网站入口，单 CSS 链接
src/main.js                  # 路由、状态与应用协调
src/ui/views/               # 主页、编辑、岁时、线索、GitHub、设置等
src/core/, src/editor/      # 手记模型、Markdown 与 CodeMirror
src/appearance/, src/glass/ # 视觉偏好、壁纸与折射
src/storage/                # 正式文库、草稿、快照、导入导出、体积统计
src/github/, src/security/  # GitHub API 和 git-crypt
src/styles/                 # 可编辑的历史样式模块 + v1.5.6 修正规则
scripts/style-order.json    # CSS 层叠清单
scripts/build-css.mjs       # 零依赖 CSS 构建
scripts/dev-server.mjs      # 本地站点与受限 GitHub API 通道
scripts/github-transport.mjs# HTTPS_PROXY / NO_PROXY 传输层
assets/vigil.css            # 生成的单一运行时样式
vendor/                     # CodeMirror / KaTeX 本地依赖
```

## 验证截图

[深色模式首页](docs/preview-156-home-night.png) · [深色模式线索页](docs/preview-156-insights-night.png) · [浅色模式首页](docs/preview-156-home-paper.png) · [手机夜间模式](docs/preview-156-mobile-night.png)

历史功能规划及原始更新日志保存在 `docs/MVP.md` 与 `docs/CHANGELOG-original.md`；已知不支持的旧版数据迁移格式与真实联网验证限制请参阅各专项文档。

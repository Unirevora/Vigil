# v1.5.5 维护修复 · 测试记录

| 检查 | 结果 | 说明 |
| --- | --- | --- |
| Node 单元测试 | **118 / 118 通过** | GitHub 请求/权限/同源 API 转发/背景映射等 |
| Chromium 视觉和状态检查 | **12 / 12 通过** | 深浅背景、侧栏模糊、玻璃 Canvas、四图独立、纯色清场、六档宽度、脚本异常 |
| Chromium GitHub UI 模拟检查 | **7 / 7 通过** | 无 Token 的公开仓库、目录、Markdown 预览、临时 Token、SHA PUT，不能落盘 |
| 布局宽度 | **320 / 390 / 768 / 1024 / 1440 / 1672px 通过** | 未发现横向滚动溢出 |
| 本地 Node 转发启动和健康接口 | **通过** | `/api/github/health` 返回 HTTP 200，不等于已连接外网 |
| GitHub API 实际上游连接 | **受环境 DNS 限制，未通过** | `api.github.com` EAI_AGAIN；未验证用户私人仓库真实授权或提交 |

### 可核对的工程内容

- `src/styles/vigil-155-repair.css`、`src/main.js`：四张背景预设、夜色、真实毛玻璃侧栏、主题切换与旧景清场。
- `src/glass/liquid-glass.js`：当前场景采样与 SVG 位移组合，不再误用上一张背景。
- `src/github/api.js`：默认直连去除容易造成预检兼容问题的额外版本请求头；同源转发、超时、状态错误与请求保留。
- `scripts/github-proxy.mjs`、`scripts/dev-server.mjs`：受限本地 API 转发与健康入口。
- `src/ui/views/github.js`：测试 GitHub 网络按钮与详细诊断。
- `tests/repair-155-integration.test.js`：主要回归与安全检查。

用户自己的两套中文字体未在 ZIP 中二次分发；`fonts/README.md` 和字体本地打包脚本保留。没有改变正式文库 JSON Schema，原本的 GitHub/git-crypt、KaTeX、三态编辑、背景点阵帷幕开关均保留。

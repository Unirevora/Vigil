# 1.5.6 · Clash 7897 二次热修复验收

| 验证项 | 结果 | 说明 |
| --- | --- | --- |
| `node --check` 核心修改模块 | 通过 | `src/github/api.js`、`src/ui/views/github.js`、`src/main.js` |
| `npm test` | 136/136 | 增加本地转发拒绝回退、502 诊断保留、混合端口设置 3 项测试 |
| CSS 构建 | 通过 | `npm run build:css` 更新运行时 `assets/vigil.css` |
| Node HTTP 本地服务 | 通过 | 首页 `/` HTTP 200、`/api/github/health` HTTP 200 |
| Node 手动代理配置接口 | 通过 | `POST /api/github/proxy` 为 HTTP 127.0.0.1:7897，返回 `MANUAL` 和正确端口；`GET` 可读回 |
| 真实 Chromium localhost UI | 未完成 | 此执行环境的 Chromium 对 localhost 导航报 `ERR_BLOCKED_BY_ADMINISTRATOR`，并非项目页面 JS 错误 |
| 用户真实 Clash 7897 -> GitHub | 待本机验证 | 环境里没有用户的 Clash 进程或 GitHub 账户，不能声称已连通 |

**运行步骤**：`npm run dev` 启动，进入 GitHub → 本地网络与代理 → 点击「Clash 7897」→ 检查 `MANUAL · 127.0.0.1:7897` → 公开仓库 `octocat/Hello-World` → 个人仓库/Token。

若出现 `DIRECT · HTTP 200`，证明服务器诊断当前未显式使用 Clash 手动配置，不意味着通过该代理连接。若出现 `MANUAL` + HTTP 200，却仍无法连接个人仓库，应分别排查 `/api/github/repos/...` 的本地请求响应与仓库权限，不要泄露令牌。

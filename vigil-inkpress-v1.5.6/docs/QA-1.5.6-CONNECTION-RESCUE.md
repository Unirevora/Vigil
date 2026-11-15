# v1.5.6 GitHub 连接诊断修复 QA

## 自动化检查（当前环境）

- `npm test`：150/150（含 10 项新增测试：匿名两种故障路径、失败聚合、令牌与写入限制、正文错误、端到端 CLI）。
- `node --check`：所有新增、修改的 JS 与 MJS 均通过语法校验。
- `scripts/dev-server.mjs` 能通过本地 HTTP 返回健康检查；其对 GitHub 代理处理异常的响应结构已实现。
- 源码保留 v1.5.6 版本号，未更新本地数据 Schema 或密钥格式。

## 环境限制

- 真实 `api.github.com` 当前执行环境 DNS 不可用，无法将公开 REST API 请求验证为真实公网成功。
- Chromium 自动导航 localhost 时由环境策略返回 `ERR_BLOCKED_BY_ADMINISTRATOR`，无法在当前环境中完成真实的视觉浏览器联调。
- 本机代理 7897 的测试仍需使用者设备。新增 `npm run diagnose:github` 提供无需 PAT 的可复制网络检查摘要。

## 安全边界

- 仅**明确匿名**的 `GET` 请求可切换浏览器跨域通道，且强制剔除 `Authorization`。
- 任何带令牌请求及 `PUT` 写入不进行第二通道重试，以免提交重复或产生意外数据泄露。
- Relay 的错误日志只记录阶段和错误码；不会打印 token、正文、密码、完整仓库路径。

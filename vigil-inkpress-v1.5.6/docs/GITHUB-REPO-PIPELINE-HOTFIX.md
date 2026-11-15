# v1.5.6 · GitHub 已联网但仓库无法连接的精确诊断

## 为什么「测试 GitHub 网络」成功仍会连接失败

`/api/github/diagnose` 会访问公开仓库元数据，仅证明固定 GitHub API 地址可通过当前 Node 代理访问。连接仓库另有多个操作：

1. `GET /repos/{owner}/{repo}` — 读取仓库信息
2. `GET /repos/{owner}/{repo}/contents[/{folder}]` — 读取默认分支/指定分支的目录
3. `GET /repos/{owner}/{repo}/contents/.gitattributes` — 可选的 git-crypt 规则信息

原实现把三个步骤作为一个不可分割的连接过程；任何非预期错误都可能被误报为「仓库连接失败」。本次把它拆分为可诊断阶段：错误会说明**仓库信息阶段**或**目录读取阶段**。` .gitattributes` 检查失败现在只显示警告，不影响只读连接；保存文件前依然执行安全检查，不会把未核验加密规则的笔记明文提交。

## 旧 Token 残留问题

旧版允许在仓库连接框留空 Token，但实际上仍继续使用本次浏览器会话里曾输入的 Token。因此即使公开仓库允许匿名读取，也可能附带过期令牌导致 401。

**修复：** 显式加入「匿名读取公开仓库」勾选框，选择后忽略本次会话 Token。另提供 **「一键连接公开示例（匿名）」**，固定目标为 `https://github.com/octocat/Hello-World`，分支和目录均为空，并且不会附加旧 Token。

## Clash 7897 验收步骤

1. 终端执行 `npm run dev`，浏览器访问 `http://127.0.0.1:5173/`。
2. 在 **GitHub → 本地网络与代理** 点 **Clash 7897**，确认显示 `MANUAL · 127.0.0.1:7897 · HTTP 200`。
3. 在连接面板直接点击 **「一键连接公开示例（匿名）」**。它不依赖当前填写的仓库地址、目录、分支或 Token。
4. 成功后应该显示 `octocat/Hello-World` 及可浏览的 `README.md`；这表明仓库数据请求链路正常。
5. 如果仍然失败，复制**完整错误文字**（会注明仓库信息阶段还是目录读取阶段）。无需发送私人仓库 URL、Token 或任何密钥。
6. 公开示例成功，但个人仓库失败，重点核对仓库 URL、分支、目录、fine-grained PAT Contents 权限、组织授权及是否误勾匿名模式。

## 已测试与边界

- `tests/github-connection-steps.test.js` 使用真实本地 HTTP relay、伪造 GitHub API 的分阶段数据，验证无令牌读取、目录错误诊断、可选属性规则读取、旧 Token 不参与匿名请求。
- 原有 `tests/github-proxy-socks.test.js` 与 `tests/github-relay-clash-7897.test.js` 保留。
- **未连接或读取用户的真实私人 GitHub 仓库，也未在当前环境访问其 Clash 节点。** 实际网络/权限最终依赖用户设备。
- 本次沿用版本号 `1.5.6`；保持原手记、草稿、备份、令牌内存保存、git-crypt 安全提交机制不变。

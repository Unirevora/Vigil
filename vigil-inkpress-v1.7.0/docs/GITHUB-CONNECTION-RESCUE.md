# GitHub 仓库信息请求仍显示 TypeError — v1.5.6 连接修复

> 本次仍为 1.5.6 的维护补丁，不更改本地手记、草稿、加密或仓库存储格式。

## 已观察到的现象

- 你在 Clash 的 HTTP 混合端口 `127.0.0.1:7897` 上配置后，GitHub 公共 API 网络检测成功；
- 一键连接公开示例 `octocat/Hello-World` 却在**仓库信息阶段**报告“本地 GitHub 同源转发请求失败（TypeError）”；
- 这属于浏览器的 `fetch('/api/github/repos/...')` 请求级失败。它**不是** GitHub 返回的 401 / 403 / 404，尚不能据此认定仓库地址或 Token 错误。

旧诊断只看到 GitHub 的 HTTP 响应头就报告 200，并没有检查完整 JSON；如果读取正文时断流，诊断会高估网络状态。

## 新修复

1. `/api/github/diagnose` 现在会读取并解码 **完整的公开仓库元数据 JSON**，只有有效的数据才算成功；结果包含 `bodyVerified: true`。
2. 对明确选择匿名模式的**公开仓库 GET 读取**，客户端会优先使用本地同源转发；当浏览器请求本地转发失败或本地转发返回 502 时，可尝试**浏览器匿名直连官方 API**。实际出口会显示“浏览器匿名直连”和本地转发失败的说明。目录与属性规则使用同一已选定通道。
3. 第二通道也失败时，会显示两条通道各自的失败类型，而不只报一个 `TypeError`。
4. **带 Token 的读取、PUT 写入和 Git-crypt 受保护文件提交没有自动直连或自动重试。** 所有匿名直连请求只保留公开的 `Accept` 请求头，显式剔除 Authorization；不能用这种只读降级连接编辑私人仓库。
5. 同源请求处理异常现在会返回结构化 `LOCAL_RELAY_ERROR`（在响应头未发送时），不再尝试发送泛化 404 造成连接中断；Node 终端记录匿名错误码，不记录 Token、请求正文与仓库地址。
6. 仓库 HTTP 200 但 JSON 不完整、缺失 `full_name` 的情况会被明确拒绝。
7. 增加 `npm run diagnose:github`，连续使用和浏览器一致的五条本地接口，安全报告请求阶段，便于锁定失败发生在本地服务、网络探测、仓库元数据还是根目录读取。

## 在你的电脑上重测（Clash 7897）

**终端一：**

```bash
npm run dev
```

进入 `http://127.0.0.1:5173/`，在「GitHub → 本地网络与代理」点击 **Clash 7897** 并应用。先确认网络测试显示“**示例仓库 JSON 已完整读取**”和 `bodyVerified` 对应成功逻辑。

之后点击 **一键连接公开示例（匿名）**。如果 Node relay 偶发异常、浏览器可以通过系统代理跨域读到公开 GitHub API，会自动使用只读的浏览器匿名通道。若显示“浏览器匿名直连”，表示只是绕过了本地 relay，不能证明私人仓库的写入通路已经正常。

**终端二：**

```bash
npm run diagnose:github
```

这会依次执行：

| 阶段 | 路径 | 成功判据 |
| --- | --- | --- |
| 本地服务 | `/api/github/health` | 200，明确 `localOnly=true` |
| 代理配置 | `/api/github/proxy` | 200，能看到 MANUAL / 127.0.0.1:7897（当已设置） |
| 网络/正文 | `/api/github/diagnose` | 200 且 `bodyVerified=true` |
| 仓库元数据 | `/api/github/repos/octocat/Hello-World` | 200，`full_name=octocat/Hello-World` |
| 仓库目录 | `/api/github/repos/octocat/Hello-World/contents` | 200，返回数组 |

此 CLI 不要求 Token、不会查询你的私人仓库，也不输出任何密钥。

### 如何判断结果

- **CLI 五项全通过，浏览器仍失败：** 重点检查浏览器开发者工具 Network 的 `/api/github/repos/` 是否被插件阻断、网页是否使用了旧缓存、实际打开的域名与端口是否一致；尝试无痕窗口并强制刷新。
- **诊断通过，但仓库元数据 / 目录接口失败：** 说明 Node 同源 relay 的具体数据请求存在差异；对照 CLI 的错误码及 `npm run dev` 的终端输出定位，不要再靠“换端口”猜测。
- **诊断也失败：** 检查 Clash 的代理模式、7897 的监听状态与本机证书，按 `EAI_AGAIN`、`ECONNREFUSED`、`TIMEOUT`、`CERT_*` 等错误分别处理。
- **公开示例能连接，个人仓库不行：** 再排查仓库地址、目录、分支、fine-grained PAT 的 Contents 权限与组织 SSO；不要把 Token、密钥发给任何人。

如终端端口不是默认 5173，可以使用 `VIGIL_PORT=实际端口 npm run diagnose:github`（PowerShell 先设置 `$env:VIGIL_PORT`）。

## 测试与限制

- 本地 mock 通过了 relay TypeError → 匿名浏览器 GET 降级、relay HTTP 502 → 匿名降级、两路失败分别报告、PAT 不直连、PUT 不重试、响应 JSON 不完整不冒充成功、命令行五阶段诊断等测试。
- **未能从当前执行环境访问真正的 api.github.com，也没有用户的 Clash 节点**；该补丁改善错误隔离并提供可工作的匿名备用路径，但不能声称真实私人仓库已连接成功。
- `git-crypt` 加解密路径与写入前的属性规则安全检查没有放宽。

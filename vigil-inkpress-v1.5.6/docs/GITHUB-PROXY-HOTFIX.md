# v1.5.6 GitHub 代理连接补丁（不改版本号）

## 修复的问题

旧版虽然提供 `/api/github/health`，却只检测**本地 Node 服务器**，不会主动请求 GitHub，因此容易出现“本地检查正常、实际连接失败”。另外旧版仅识别 `HTTP_PROXY` / `HTTPS_PROXY` 中的 HTTP(S) 代理地址，不支持 SOCKS5；很多全局代理软件不会给 Node 自动注入这些环境变量。

新版：

1. 「GitHub 仓库 → 本地网络与代理」可在界面选择 `自动读取 Node 环境`、`直连`、`本机 HTTP 代理`、`本机 SOCKS5 代理`，并填写本机端口；点击「应用并测试」。
2. 本地服务器支持 `HTTPS_PROXY` / `HTTP_PROXY` / `ALL_PROXY` 环境变量；接受 `http://`、`https://`、`socks5://`、`socks5h://`。选择本机 SOCKS5 时，GitHub 域名通过代理端解析（远程 DNS）。
3. `/api/github/health` **只**报告本地服务就绪；`/api/github/diagnose` 才会真正请求 GitHub 官方 API，返回可读的外网状态和 `ECONNREFUSED` / `PROXY_CONNECT_407` / `SOCKS_CONNECT_5` 等诊断码。
4. 本地代理配置只放在当前 Node 服务的**内存**里，不写入手记、配置文件或 localStorage。重启开发服务需要重新选择；需要长期使用可设置系统环境变量。
5. GitHub 请求地址仍严格限制为 `https://api.github.com`；浏览器设置入口仅接受 `127.0.0.1`、`localhost`、`::1` 的端口。企业远程代理可在启动终端以环境变量配置。
6. 保留 HTTPS 证书校验、git-crypt 文件保护、GitHub Token 内存隔离和 SHA 冲突检查。不对可能已经提交的 PUT 请求自动重试。

## 推荐的排查顺序

1. 在代理软件中查看**本地 HTTP 端口、SOCKS 端口或 Mixed 端口**（不是远程服务的端口）。例如有的软件 HTTP/Mixed 是 7890，SOCKS 是 7891；具体以你的软件为准。
2. 用 `npm run dev` 启动，打开 `http://127.0.0.1:5173/`，进入 **GitHub 仓库 → 本地网络与代理**。
3. 如果 HTTP/Mixed 端口是 7890，就选择 `本机 HTTP 代理`，主机 `127.0.0.1`，端口 `7890`。如果只有 SOCKS5 端口，选择 `本机 SOCKS5 代理`，填实际端口。
4. 点击 **应用并测试**，等待 GitHub 公共 API 的结果。网络畅通之后，再尝试目标仓库和 Token。
5. 如果网络可访问但你的仓库返回 HTTP 401/403/404：检查仓库名、分支、细粒度 Token 的 `Contents` 权限和组织 SSO。这与代理问题不同。

### 终端环境变量（可选）

Windows PowerShell（替换 7890 为实际端口）：

```powershell
$env:HTTPS_PROXY="http://127.0.0.1:7890"
$env:HTTP_PROXY="http://127.0.0.1:7890"
npm run dev
```

macOS / Linux：

```bash
HTTPS_PROXY=http://127.0.0.1:7890 HTTP_PROXY=http://127.0.0.1:7890 npm run dev
```

如果只开放 SOCKS5：

```bash
ALL_PROXY=socks5h://127.0.0.1:7891 npm run dev
```

注意：现有 `HTTPS_PROXY` 优先于 `ALL_PROXY`，因此当两者同时存在时，请检查是否仍指向旧代理。页面上手动选择可以临时覆盖环境变量。若在 WSL / Docker 内运行，`127.0.0.1` 可能指向容器而不是宿主机；这时应检查网络隔离及代理监听地址，并从终端正确配置可达的代理地址。

## 常见诊断码

| 诊断码 | 说明 | 优先检查 |
| --- | --- | --- |
| `ECONNREFUSED` | 本地代理端口无人监听 | 本机端口、软件是否运行、HTTP/SOCKS 类型 |
| `PROXY_CONNECT_407` | HTTP CONNECT 代理要求认证 | 代理权限或环境变量认证信息 |
| `SOCKS_AUTH_REJECTED` / `SOCKS_AUTH_FAILED` | SOCKS5 认证失败 | SOCKS 用户名密码；应用界面仅支持无认证本机代理 |
| `SOCKS_CONNECT_5` | SOCKS 拒绝目标连接 | 节点、规则、代理服务端的访问限制 |
| `ENOTFOUND` / `EAI_AGAIN` | 本地 DNS 无法解析 | 使用 SOCKS5 远程 DNS；检查系统 DNS |
| `CERT_*` / `UNABLE_TO_VERIFY_LEAF_SIGNATURE` | TLS 证书校验失败 | 公司 HTTPS 中间人代理或 CA 配置；**不要关闭证书验证** |
| `GITHUB_TIMEOUT` | 连接 GitHub 超时 | 端口可达性、节点稳定性、代理出口 |
| 401 / 403 / 404 | GitHub 已响应但 API 拒绝 | Token / 仓库权限 / 仓库地址 |

## 安全与测试边界

- 已通过本机模拟的 HTTP CONNECT 与 SOCKS5 代理，对模拟 `api.github.com` **TLS 证书校验**并读取 REST 响应；没有放宽正式项目的证书验证。
- 已通过 SOCKS5 远程 DNS、用户/密码、代理拒绝、非法设置、同源访问限制及 HTTP 诊断的自动化测试。
- 当前执行环境的公网 DNS 与浏览器网络访问受限，**未实测你的真实代理软件和私人 GitHub 仓库**。如本地仍失败，请提供「测试 GitHub 网络」输出的错误码，以及代理类型和端口（不要提供 Token 或密码）。

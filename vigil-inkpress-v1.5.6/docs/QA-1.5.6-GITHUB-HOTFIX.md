# v1.5.6 · GitHub 本地代理补丁验收

## 执行结果

| 检查项目 | 结果 |
| --- | --- |
| `npm test` | 133/133 通过 |
| JS 模块语法 | 通过 |
| SOCKS5 远程 DNS 请求格式 | 模拟握手通过，目标为 `api.github.com:443` |
| SOCKS5 用户名与密码握手 | 通过 |
| SOCKS5 拒绝目标连接 | 返回精确错误码 `SOCKS_CONNECT_5` |
| 手动配置地址限制 | 拒绝非回环地址、无效端口、未知代理模式 |
| `/api/github/proxy` GET/POST | 通过，节点配置只在 Node 进程内 |
| `/api/github/health` | 只说明本地可用，返回 `upstreamTested:false` |
| `/api/github/diagnose` | 实际执行 GitHub 请求；可分别报告网络成功/失败 |
| 实际本地 Node 服务与无效端口 | 返回 `GITHUB_UNREACHABLE`、`ECONNREFUSED`，错误说明对应代理端口拒绝 |
| HTTP CONNECT → 有效 HTTPS TLS → REST GET | 使用本地模拟 GitHub 的 TLS 服务器、临时 CA 验证通过 |
| SOCKS5 → 有效 HTTPS TLS → REST GET | 同上，验证通过 |
| Chromium GitHub 代理设置页 | 使用离线内联源代码夹具检查 1440px / 390px：无 JS 错误及水平溢出 |
| 真实 `api.github.com` 公网请求 | 未验证：当前执行环境 DNS/浏览器外网受限 |
| 用户自己的代理软件、私人仓库连接 | 未验证：需要在用户本机执行 |

## 说明

本地模拟测试使用临时自签名 CA，仅用于离线模拟 TLS，不包含在交付项目内。正式代码始终使用 `rejectUnauthorized:true`，不关闭 TLS 验证。

浏览器网络跳转在当前执行环境被策略阻止，因此 Chromium UI 验证使用来自真实源码的临时内联夹具；端口读写与实际代理诊断则在真实 `npm run dev` Node 本地服务上以 HTTP 请求验证。两者不可偷换成“已通过真实私人 GitHub 仓库连接”。

源代码补丁不更改手记数据结构、git-crypt 规则、Token 临时内存存储、SHA 冲突处理或项目版本号（1.5.6）。

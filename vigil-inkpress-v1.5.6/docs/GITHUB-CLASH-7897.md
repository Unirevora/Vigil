# v1.5.6 补丁 · Clash 7897 与仓库连接错误处理

## 用户反馈与原因

界面先显示「GitHub 公共 API 已响应 · DIRECT · HTTP 200」，随后连接仓库报「GitHub 网络请求失败（TypeError）」。这两个结果不能直接归因为网络断开：

1. `/api/github/diagnose` 访问固定的 `octocat/Hello-World`，200 只证明**网络探测路径**可以响应，不代表目标仓库可以读写。
2. `DIRECT` 表明当前 Node GitHub 传输层未显式选择代理。即使 Clash 开启了系统代理，Node 进程也不一定自动使用它。
3. 原 `GithubClient.request()` 在本地同源 GET 转发 `fetch()` 抛异常后，会静默尝试浏览器跨域直连 GitHub。第二次请求可能因 CORS、网络代理、扩展或凭据预检失败而抛 `TypeError`，掩盖第一条请求真正的诊断原因。

## 本补丁

- GitHub → 本地网络与代理新增 **Clash 7897** 快捷按钮，直接设置 `HTTP / 127.0.0.1 / 7897` 并调用已存在的「应用并测试」。
- Clash 类混合端口通常同时接受 HTTP CONNECT 和 SOCKS5。若 HTTP 失败，手动改选 SOCKS5，仍可使用 `127.0.0.1:7897`；以用户实际端口为准。
- 同源转发的网络异常不再自动退回浏览器直连；直接报告本地通道失败。带令牌的请求即使本地接口缺失也不会回退，以免绕过原本的同源安全边界。
- 公共仓库在真正没有 `/api/github` 转发器的静态 `localhost` 站点上，仍可匿名直连 GitHub；有令牌的请求需本地转发。
- `PUT` 提交失败仍**绝不自动重试**，避免写入已经成功却收到网络错误时重复提交。
- 调整代理设置区的 grid，桌面五个子项可排布，平板与手机自动回到双列/单列。

## 验证步骤

1. 启动 `npm run dev`，使用 `http://127.0.0.1:5173` 打开软件。
2. GitHub 仓库 → 本地网络与代理 → 点击 **Clash 7897**，等待应用并测试。
3. 预期：GitHub 诊断显示 `MANUAL · 127.0.0.1:7897 · HTTP 200`，不是 `DIRECT`。
4. 再尝试一个不需要令牌的公开仓库，例如 `https://github.com/octocat/Hello-World`；分支和目录先留空。
5. 公开仓库成功后再连接私有仓库；需要对仓库有 Contents 读取权限的 fine-grained PAT。令牌仅放在当前页面会话内存。
6. 失败时读取错误码：`ECONNREFUSED` 是本地端口拒绝连接；`PROXY_CONNECT_*` 是 HTTP 隧道错误；`SOCKS_CONNECT_*` 是 SOCKS 代理错误；HTTP 401/403/404 表示 GitHub 已响应但认证或资源有问题。

可在电脑同一终端中独立检查（不包含令牌）：

```bash
curl --proxy http://127.0.0.1:7897 -I https://api.github.com/repos/octocat/Hello-World
```

不能从此脚本断言用户的 GitHub 账户/私人仓库已成功连接。公网与代理是否正常必须在用户设备上验收。

**安全边界**：这个补丁不上传代理密码、不记录 Token、不扩大同源转发允许的 GitHub URL 范围，不关闭 TLS 证书校验。

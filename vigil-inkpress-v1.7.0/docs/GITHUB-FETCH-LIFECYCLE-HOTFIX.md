# 1.5.6 热修复：浏览器诊断 PASS，但匿名连接三个通道 TypeError

## 问题与可复现证据

用户提供了以下已确认的现象：

- `npm run diagnose:github` 本地服务、Clash 7897、公共仓库元数据与目录均 PASS；
- 浏览器的四条链路检查也全部 PASS，公共仓库 HTTP 200；
- 但「一键连接公开示例（匿名）」在 `metadata` 阶段连续出现三条 `TypeError`。

根因之一是旧版 `GithubClient` 在模块启动时保留 `globalThis.fetch` 的**旧引用**，而浏览器诊断每次启动时获取**当前引用**。浏览器扩展、请求拦截器或 Web 环境注入若在页面加载后替换 `fetch`，两条流程就可能走不同实现。

### 可控复现（旧版失败，新版通过）

1. 模拟页面初始化时 `window.fetch` 是一个会抛出 `TypeError` 的旧包装函数。
2. 创建 `GithubClient`。
3. 模拟扩展/网络层将 `window.fetch` 更新为能够返回完整 GitHub JSON 的新函数。
4. 先运行浏览器链路探测（四项 PASS），再连接公开仓库。
5. 原代码得到与用户日志一致的 `metadata` / 三个 `TypeError`；本次修复使用新的 `fetch`，完成仓库元数据与目录读取。

这能**证明原代码存在此类不一致缺陷**，但并不能证明用户本机 Chrome/Clash 中一定发生了 `fetch` 替换。无需重新配置已验证正常的 Clash 7897。

## 本次代码修复

- `src/github/api.js`：默认客户端改为每次请求调用 `globalThis.fetch(url, options)`，不捕获启动时的旧接口；仅明确注入的测试 fetcher 继续固定。
- 不改变匿名读取 / PAT 读取 / PUT 写入的原有权限策略。只有匿名 GET 可以尝试备用读取通道，Token 和提交不会自动转发至匿名通道，也不会自动重试写入。
- 失败追踪增加明确的失败步骤：`发送请求`、`检查响应头`、`读取 JSON` 或 `校验状态`；对浏览器 `TypeError` 只输出预定义类别 `FETCH_REJECTED`、`ILLEGAL_INVOCATION`、`JS_TYPE_ERROR`，不记录仓库地址、密钥、请求体或令牌。
- `src/main.js`：GitHub 页面可展开的错误详情展示这些步骤，而非三个无法区分的 TypeError。

## 自动化验收

- `node --test tests/github-live-fetch-regression.test.js`：4 项 PASS。
- 原文件运行同一回归测试，核心案例失败并产生三条 TypeError；修改后同案 PASS。
- 独立 Chromium 运行同一 `GithubClient` 代码，在 `about:blank` 上模拟 `fetch` 更新；旧版 3 次调用旧函数并失败，新版成功获取公开仓库元数据与目录。
- `npm test`：162 项 PASS（含原有 158 项和 4 项新测试）。
- 本地 HTTP 服务与静态文件可通过 Node/curl 检查，但当前自动化 Chromium 环境**不允许导航到本地 HTTP 页面**；不把孤立客户端浏览器测试当作整个 UI 的端到端验收。

## 用户需要完成的一次验证

1. 关闭旧 `npm run dev` 进程，解压最新版热修复包，进入其中项目目录重新运行 `npm run dev`。
2. 在浏览器硬刷新 `http://127.0.0.1:5173/`；确保未通过另一个仍在运行的旧服务打开网页。
3. 使用现有 Clash 7897 设置，不必改变 HTTP/SOCKS5 端口。点「一键连接公开示例（匿名）」。
4. 若仍失败，复制「查看实际请求阶段与通道」中的内容。这次将会显示 `发送请求` 或 `读取 JSON` 等详细环节，不必再次提供已经全部 PASS 的网络诊断。

**安全边界：** 请勿分享 PAT、代理密码或私密笔记正文。本热修复不改变本地手记数据结构、编辑器或 git-crypt 的加密实现。真实连接仍需在用户电脑中验证。

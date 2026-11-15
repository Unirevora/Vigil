# v1.5.6 · 浏览器 GitHub 仓库连接请求一致性修复

## 用户给出的确切证据

`npm run diagnose:github` 中 Node 本地服务、Clash 7897 代理、完整 JSON、公开仓库元数据和根目录均已成功；随后浏览器四项链路检查也全部返回 PASS：

```
当前页面：http://127.0.0.1:5173
PASS  本地网络探测 · HTTP 200 · RELAY
PASS  仓库主通道 · HTTP 200 · RELAY
PASS  仓库备用通道 · HTTP 200 · RELAY
PASS  浏览器匿名直连 · HTTP 200 · OTHER
```

但按钮 **一键连接公开示例（匿名）** 仍失败。这表明泛化网络探测不能代表应用真实仓库请求；在当前证据下不应再让用户更换 Clash 代理、端口或 Token。

## 代码差异和本次修复

1. 旧版探测请求使用 `Accept: application/json`、`credentials: omit`、`cache: no-store`、`redirect: error`；旧仓库客户端的匿名请求却发送 `Accept: application/vnd.github+json`。这**是已确认的请求参数不一致**，但缺少用户浏览器 Network 日志，不能断言它就是唯一根因。
2. 匿名仓库读取现在采用与通过的浏览器探测相同的 GET 参数；本地 Node relay 仍为上游请求附加官方 API 版本和标准 `User-Agent`，不依赖浏览器添加自定义版本头。
3. 主通道、备用本地通道、浏览器匿名直连各自使用独立的 AbortController 和 15 秒超时，避免主通道的取消信号错误影响第二条通道。
4. 读取 JSON 正文时出现 TypeError、截断或错误格式，会对**匿名 GET**使用可控后备路径；GitHub 返回真实 HTTP 401/403/404/409/422 不会被改写成网络故障，严禁对提交 PUT 或带 Token 的私有读取重试。
5. 异常时在 GitHub 页面展示“实际请求详情”，仅包含连接阶段、通道名称、HTTP 状态或错误码。不写入本地存储，不显示 Token、仓库 URL、笔记正文。
6. 原有 `git-crypt` 加密提交和 GitHub Contents SHA 并发冲突保护保持不变。

## 测试边界

- 使用 Node test 模拟浏览器网络政策：四项探测全部通过，而旧 vendor Accept 被拦截；验证新匿名连接完整读取仓库信息、目录及 `.gitattributes`。
- 测试主通道 JSON 流中断后、备用通道使用新的未取消信号；并确认 Token 读取与 PUT 不进行匿名后备。
- 本地 `npm run dev` 对首页、CSS、`src/main.js`、GitHub 客户端脚本和 `/api/github/health` 的 HTTP 烟测已通过。
- **自动化浏览器在当前环境被管理策略阻止访问 localhost**，无法替用户的真实 Clash/浏览器做最终连接验收。请在本机完成一键公开仓库连接测试。

## 本机最后检查

用新包完整替换旧项目并停止旧 Node 进程；从新项目目录 `npm run dev`。在浏览器硬刷新后，保持已证明正常的 Clash 7897。点击“连接公开示例（匿名）”。若再次失败，展开出现的“查看这次连接的实际请求阶段与通道”并复制其中的通道与状态即可；不需要再次提供五项 Node 诊断和四项浏览器探测，也不要发送 Token。

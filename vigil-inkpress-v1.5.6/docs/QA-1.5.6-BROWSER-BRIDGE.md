# 浏览器仓库链路修复 QA · v1.5.6

- 版本号：1.5.6（不变）
- 单元测试：`npm test`，见发布记录
- HTTP relay 测试：主路径和备用路径均允许读取公开仓库元数据与目录，包含 Authorization 或 PUT 的备用请求返回 403。
- 客户端模拟：主路径抛 `ERR_BLOCKED_BY_CLIENT` 后备用读取元数据/目录/.gitattributes 成功；后续请求保持备用通道，不向浏览器直连发送 Token。
- 所有通道失败时报告三个独立错误，避免 `TypeError` 被包装成泛化错误。
- 页面诊断函数：验证四个公开请求、状态、完整 JSON 和未发送凭据。
- 本地服务器启动测试：`npm run dev` + 模拟 GitHub 上游完成首页、样式、双同源路径、匿名权限保护，以及六项 CLI 诊断。
- 限制：Chromium 自动化受运行环境本地/虚拟域名访问策略限制（`ERR_BLOCKED_BY_ADMINISTRATOR`），所以这里未完成真实浏览器页面端到端测试；真人浏览器与 Clash 7897 的最终检验需在用户本机执行。

# 不眠手记 v1.5.5 · 视觉与 GitHub 连接修复说明

**这是 v1.5.5 的维护修复，不升级版本号，不修改正式手记、草稿或 git-crypt 的数据协议。**

## 背景与深色模式

- 旧版「素笺／青绿」原本重复引用同一个黎明背景。现在四个预设使用独立图片：纸面/晴岚 `wallpaper-dawn-1672.png`，晨雾 `wallpaper-cloud-mist-2560.webp`，青绿 `wallpaper-garden-1672.webp`，月夜 `wallpaper-moonrise-1672.png`。
- 这四张图片的资源地址在 `src/main.js` 的外观映射、`src/styles/vigil-155-repair.css` 的背景和预览中保持一致；自定义图片仍从用户自己的 IndexedDB 加载。
- 深色模式不再把底景不透明度、亮度和遮罩层一再相乘至接近全黑；`--wallpaper-alpha-night` 根据用户背景强度派生，纯色（背景关闭）依然彻底关闭。
- 夜色整体从绿黑改为石墨灰，同时保留朱砂、纸张和极轻的文房气质。

## 液态玻璃与侧栏

- 仅悬浮搜索、工具条、按钮使用玻璃材质；正文、编辑器、长内容仍是稳定纸面。
- 光学折射由 Canvas 对**当前实际背景图**重新采样，再与 SVG 位移层叠，中心不过度变形。切换背景或明暗模式会刷新采样；关闭背景时销毁过期采样图层。
- 在支持 `backdrop-filter` 的浏览器中，侧栏启用真实背景模糊（默认 24px）及淡淡的主题染色，而非固定的不透明绿色底色；尊重用户自定义模糊和浓度。系统请求减少透明度时会降级为实色背景。
- 启动时不需要 React Bits Pro 授权，也没有包含其私有 Spectral Drape 组件代码；已有原创 Canvas 点阵帷幕开关继续保留。

## GitHub 连接修复

**推荐使用本项目自带的 Node 本地开发服务器：**

```bash
npm run dev
```

然后打开 `http://127.0.0.1:5173/`，进入「GitHub 仓库」界面，先点「测试 GitHub 网络」，**该测试无需输入 Token**。

- 本地网页现在优先走受限的同源 API 通道 `/api/github/...`，由 Node 服务器访问 `https://api.github.com`；允许匿名读取 GitHub 公开仓库的仓库信息、目录、Markdown，或携带临时 Token 提交带 SHA 的变更。
- 服务端只接受针对 GitHub 真实 REST 仓库与 Contents 路径的 `GET/PUT`，不提供任意 URL 的开放代理，不记录或保存 Token，不写入用户手记数据。
- 项目部署到**纯静态网站**时，客户端仍可直接访问 GitHub REST API。为兼容浏览器预检要求，直连不额外发送 `X-GitHub-Api-Version` 自定义请求头，受限 Node 同源转发负责固定一个受支持的 API 版本。
- 公开仓库读取通常不需要 Token；私有仓库或创建/修改文件需要足够的 GitHub Contents 权限；git-crypt 加密路径仍需对应用户密钥。
- 如提交时遇到仓库 SHA 冲突，仍按已有逻辑保留编辑文字并拒绝覆盖，令牌只在当前页面内存保存。
- 失败后仓库 URL、分支和目录输入不会清空；网络自检错误会区分 DNS、代理/超时、HTTP 401、403、404、409 等情况。

### 错误定位清单

| 错误/表现 | 可能原因 | 检查方法 |
| --- | --- | --- |
| 「本地服务无法访问 api.github.com」+ `EAI_AGAIN` / `ENOTFOUND` | Node 运行机器 DNS 解析失败 | 检查 DNS、企业代理、`curl -I https://api.github.com` |
| `GITHUB_TIMEOUT` | DNS 慢、TLS 失败、企业代理未被 Node 使用 | 检查网络、代理配置和防火墙；不要直接关闭浏览器安全限制 |
| `401` | 临时 Token 无效/过期 | 重新签发限制在目标仓库的细粒度 Token |
| `403` | 权限不足或 GitHub API 频率限制 | 检查 Contents 读/写权限和限流提示 |
| `404` | 仓库不存在、仓库私有但未授权、分支/子目录错误 | 先用公开仓库自检，再校验 URL、分支和目录 |
| `409` | 远端文件已修改 | 复制当前编辑内容，与最新文件比较后再提交 |
| 浏览器直连出现 CORS/预检异常 | 部署时没有同源通道、浏览器安全策略或代理改写 | 用 `npm run dev` 验证；检查开发者工具 Network/OPTIONS，确定真正的失败请求 |

`/api/github/health` 仅能验证 **本地转发程序正常启动**，不能证明真正能访问 GitHub。真正的互联网连通性请使用页面中的「测试 GitHub 网络」按钮。

## 官方资料

- GitHub REST API：<https://docs.github.com/en/rest>
- Contents API：<https://docs.github.com/en/rest/repos/contents>
- 细粒度 Token 权限：<https://docs.github.com/en/rest/authentication/permissions-required-for-fine-grained-personal-access-tokens>

## 验收边界

当前执行环境可启动 Node 本地服务，`/api/github/health` 返回 200；但 `curl` 和 Node 对 `api.github.com` 的实际访问在当前环境发生 DNS 失败（EAI_AGAIN）。所以**没有声称真实联网 GitHub 提交成功**。本项目已通过匿名连接、目录读取、文件预览、临时 Token、携带 SHA 的模拟 PUT 写入和不落盘检查；请在你自己的网络环境再做一遍实际仓库授权与提交测试。

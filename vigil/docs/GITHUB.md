# GitHub 仓库连接、同源中继与 git-crypt

本文是 GitHub 相关功能的唯一参考：连接仓库、请求通道（同源中继 / 浏览器直连）、代理设置、诊断与故障排查，以及 git-crypt 加解密。旧的分版本热修复文档（`GITHUB-*-HOTFIX.md`、`GITHUB-CLASH-7897.md`、`GIT-CRYPT-1.5.md` 等）只保留历史价值，内容以本文为准。

实现文件：

| 模块 | 职责 |
| --- | --- |
| `src/github/api.js` | `GithubClient`：仓库配置校验、通道选择、Contents API 读写、git-crypt 规则检查 |
| `src/github/connection.js` | 连接三阶段（仓库信息 → 目录 → `.gitattributes`） |
| `src/github/browser-diagnostics.js` | 页面内「浏览器链路检查」的四项公开探测 |
| `src/security/git-crypt.js` | git-crypt 密钥解析、加解密、`.gitattributes` 规则匹配 |
| `scripts/dev-server.mjs` | 静态文件 + 同源中继；为 `index.html` 注入 `<meta name="vigil-relay">` |
| `scripts/github-proxy.mjs` | 中继路由：`api/github/...`、`api/vigil-bridge/...` |
| `scripts/github-transport.mjs` | 中继到 `api.github.com` 的出站传输（直连 / HTTP CONNECT / SOCKS5） |
| `scripts/diagnose-github.mjs` | `npm run diagnose:github` 命令行诊断 |
| `scripts/deploy.mjs` | 服务器部署（systemd + nginx，见下文） |

---

## 1. 概览

- 「GitHub 仓库」页连接一个**已存在**的 GitHub 仓库，浏览目录、阅读 Markdown；有合适令牌时可新建或修改 `.md` / `.markdown` / `.mdown` 文件并直接产生一次 Git 提交。
- 仓库被加入「全部手记」的 GitHub 页签，使用与本地手记相同的阅读页和编辑器；但**远端笔记与本地手记分开存储**，不会合并进本地 JSON，本地 JSON 备份也不包含 GitHub 文件。
- 所有请求只访问 GitHub REST 的仓库元数据与 Contents API：
  - `GET /repos/{owner}/{repo}` — 仓库信息
  - `GET /repos/{owner}/{repo}/contents/{path}?ref={branch}` — 目录列表 / 文件内容（Base64）
  - `PUT /repos/{owner}/{repo}/contents/{path}` — 提交文件（带提交信息、Base64 内容、分支、旧 SHA）
- 请求要么经同源 Node 中继发出，要么由浏览器直接请求 `api.github.com`（详见第 3 节）。

---

## 2. 连接仓库

### 2.1 填写项

| 字段 | 说明 |
| --- | --- |
| 仓库地址 | `https://github.com/用户名/仓库名`，也接受 `用户名/仓库名`；末尾 `.git`、`/` 会被去掉 |
| 分支 | 可留空，留空使用仓库默认分支；含 `..`、空白、`~^:?*[]\` 等字符的分支名会被拒绝 |
| 笔记文件夹 | 可留空（仓库根目录）；不允许 `.`、`..`、重复斜杠；新建笔记必须位于该文件夹内 |
| Fine-grained Token | 仅私有仓库或需要提交时填写；只保存在本页内存 |

仓库地址、分支、文件夹会保存到浏览器 `localStorage`（键 `vigil-github-repository-v1`），方便下次填写；**令牌从不保存**。

### 2.2 匿名读取（无需令牌）

- 公开仓库可以不填令牌直接只读浏览。
- 勾选「**匿名读取公开仓库**」后，本次连接会**丢弃**本会话中之前输入过的令牌，避免过期令牌导致 401；同时允许匿名读请求在通道失败时依次尝试备用通道（见 3.3）。
- 「**一键连接公开示例（匿名）**」固定连接 `octocat/Hello-World`，分支与目录为空，不读取表单中的任何地址或令牌。用于区分「网络/通道问题」与「自己的仓库地址或权限问题」。

### 2.3 令牌连接（私有仓库、写入）

在 GitHub 创建 **fine-grained personal access token**：

1. Repository access 选择**仅目标仓库**，不要授权全账号。
2. Repository permissions → `Contents`：只读选 `Read-only`，需要提交选 `Read and write`。
3. 组织仓库如启用 SSO，需要为令牌完成组织授权。

令牌只存在于当前页面的 JavaScript 内存：不写入 `localStorage`、`sessionStorage`、IndexedDB、JSON 导出或下载文件。刷新页面后需重新输入；点击「断开」立即清除令牌和已导入的 git-crypt 密钥。连接失败时会恢复为连接前的配置与令牌状态。

### 2.4 连接的三个阶段

连接（`inspectGithubRepository`）按顺序执行，失败信息会注明阶段：

1. **仓库信息**：`GET /repos/{owner}/{repo}`，必须返回含 `full_name` 的有效 JSON；
2. **根目录与 Markdown 文件**：列出所选文件夹，只显示子目录和 Markdown 文件；
3. **加密属性规则**：读取根目录 `.gitattributes`。此步失败**只显示警告**，不影响只读浏览；写入前仍会强制重新检查规则。

三个阶段使用同一客户端、同一通道。连接后可点「**检查连接**」重新验证仓库信息、当前目录和根 `.gitattributes`。

---

## 3. 请求通道与同源中继

### 3.1 何时使用同源中继

页面满足以下任一条件、且以 `http:` / `https:` 打开时，使用同源 Node 中继：

- 页面主机名是 `localhost` 或 `127.0.0.1`；
- 页面由 `scripts/dev-server.mjs` 提供——它会在 `index.html` 的 `</head>` 前注入 `<meta name="vigil-relay" content="same-origin">`，因此在任意主机名（例如 nginx 后的服务器）上都启用中继。

否则（纯静态托管、`file://` 等）浏览器**直接请求** `https://api.github.com`。

### 3.2 中继接口

所有中继地址都是**相对于当前页面**的路径（`api/github/...`，不以 `/` 开头），因此应用部署在子路径下（如 `https://host:8443/vigil/`）时请求会落到 `/vigil/api/github/...`。

| 路径 | 方法 | 作用 |
| --- | --- | --- |
| `api/github/health` | GET | 只说明本地中继已启动（`localOnly: true`），**不访问 GitHub** |
| `api/github/proxy` | GET / POST | 读取 / 修改中继的出站代理设置（第 4 节） |
| `api/github/diagnose` | GET | 由中继真实请求 `octocat/Hello-World` 并完整解析 JSON，成功时 `bodyVerified: true` |
| `api/github/repos/{owner}/{repo}[/contents/...]` | GET / PUT | 主通道；PUT 只允许具体文件路径 |
| `api/vigil-bridge/repos/{owner}/{repo}[/contents/...]` | 仅 GET | 备用只读通道；带 `Authorization` 或非 GET 一律 403 `ANONYMOUS_READ_ONLY` |

中继的约束：

- 只转发到 `https://api.github.com`，路径必须匹配仓库 / Contents 格式，查询参数只允许 `ref`；不是通用代理。
- 上游请求固定附加 `Accept: application/vnd.github+json`、`X-GitHub-Api-Version: 2022-11-28` 和固定 `User-Agent`；`redirect: error`；单次上游超时 16 秒。
- `Authorization` 只接受 `Bearer <token>` 格式，原样转发给 GitHub，不记录、不保存。日志只写阶段与错误码。
- PUT 正文上限 3 MB，上游响应上限 7 MB。
- 每个中继响应都带 `X-Vigil-Github-Proxy: 1`。客户端若在中继路径上收不到这个头（例如另一个静态服务器返回了 HTML），视为 `LOCAL_RELAY_MISSING`。
- 中继只信任回环 Host（`127.0.0.1` / `localhost`）；若带 `Origin`，必须是同主机的 `http:` 来源，否则 403 `ORIGIN_DENIED`。

### 3.3 通道选择规则

| 请求类型 | 有中继时的通道顺序 | 无中继时 |
| --- | --- | --- |
| 带令牌的读取、所有 PUT | 仅 `api/github`；**不回退、不重试** | 直连 `api.github.com` |
| 无令牌、未勾选匿名 | `api/github`；仅当响应缺少中继标记头时改为直连 | 直连 |
| 勾选匿名 / 一键公开示例 | `api/github` → `api/vigil-bridge` → 直连 | 直连 |

- 只有匿名 GET 会尝试下一条通道，触发条件仅限网络类故障：fetch 被拒绝（TypeError）、超时、缺少中继标记头、JSON 正文损坏/不完整、中继 502。GitHub 真实返回的 401/403/404/409/422 **不会**被下一条通道掩盖。
- 每次尝试都有独立的 15 秒超时，不会把上一通道的取消信号带到下一通道。
- 匿名连接一旦经备用或直连通道成功，后续目录和文件读取继续使用该通道，界面会提示「已使用备用本地通道 / 浏览器匿名直连」。经直连成功**只证明公开只读可用**，不代表写入通路正常。
- 客户端每次请求都调用当时的 `globalThis.fetch`，不缓存启动时的引用（浏览器扩展可能在加载后替换 `fetch`）。

### 3.4 请求参数（credentials）

- **中继请求**使用 `credentials: 'same-origin'`。Safari 对 `credentials: 'omit'` 的请求使用独立会话，不认访客为自签名 HTTPS 证书添加的例外，会在发送前失败（`Load failed` → `FETCH_REJECTED`）。中继本身不使用 Cookie，服务器部署时 nginx 也会剥离 Cookie。
- **直连 GitHub** 使用 `credentials: 'omit'`。
- 所有请求都是 `cache: 'no-store'`、`redirect: 'error'`。匿名 GET 只发送 `Accept: application/json`（与浏览器链路检查完全一致）；带令牌的请求发送 `Accept: application/vnd.github+json` 与 `Authorization`。浏览器直连**不发送** `X-GitHub-Api-Version`，以免触发额外的 CORS 预检限制，GitHub 使用其默认版本。

### 3.5 本地开发

```bash
npm run dev          # 构建 CSS 并启动 scripts/dev-server.mjs，监听 127.0.0.1:5173
```

打开 `http://127.0.0.1:5173/`。端口可用环境变量 `PORT` 修改。开发服务器只监听回环地址。

### 3.6 服务器部署（nginx + Node）

`npm run deploy`（`scripts/deploy.mjs`）把应用部署为 `https://<主机>:8443/vigil/`：

- systemd 运行 `scripts/dev-server.mjs`（`127.0.0.1:PORT`），并设置 `VIGIL_PROXY_LOCK=1`；
- nginx 把 `/vigil/` 反代到 Node；`/vigil/api/` 额外做同源检查：请求带 `Origin` 时必须等于 `scheme://host`（含端口），否则 nginx 直接返回 403；然后把 `Host` 改写为 `127.0.0.1:PORT`、清空 `Origin` 和 `Cookie` 再转发，使中继的回环检查通过；
- HTTP 访问 `/vigil` 会跳转到 HTTPS（Web Crypto / git-crypt 需要安全上下文）；
- 部署脚本的健康检查包括：页面含 `vigil-relay` 标记、`api/github/health` 为 200、跨站 `Origin` 被拒（403）、`POST api/github/proxy` 返回 409。

在服务器部署下，GitHub 请求由**服务器**发出：令牌会经过服务器中继转发给 GitHub（不记录、不保存），出站网络是服务器的网络。

---

## 4. 代理设置（仅本地开发）

代理只影响**中继（Node 进程）**访问 GitHub 的出站连接，与浏览器自身的系统代理无关。全局代理软件不一定会被 Node 继承，所以需要单独设置。

### 4.1 页面设置

「GitHub 仓库 → 本地网络与代理」：

| 方式 | 说明 |
| --- | --- |
| 自动读取 Node 环境 | 默认；按环境变量决定（见 4.2） |
| 直接连接 | 忽略环境变量，不走代理 |
| 本机 HTTP 代理 | HTTP CONNECT 隧道 |
| 本机 SOCKS5 代理 | SOCKS5，GitHub 域名由代理端解析（远程 DNS） |

- 主机只能是 `127.0.0.1`、`localhost`、`::1`，端口 1–65535；页面不支持代理用户名密码。
- 「应用并测试」提交设置后会立即调用 `api/github/diagnose`。
- 「Clash 7897」快捷按钮等同于选择「本机 HTTP 代理 / 127.0.0.1 / 7897」并应用。Clash Verge / Mihomo 的混合端口通常同时接受 HTTP 与 SOCKS5；HTTP 失败时可改选 SOCKS5，同一端口。以自己软件显示的实际端口为准。
- 设置只保存在 Node 进程内存，重启 `npm run dev` 后恢复为「自动读取 Node 环境」；不写入文件或 `localStorage`。
- 诊断显示 `DIRECT · HTTP 200` 只表示中继未使用代理也能连通，并不代表代理生效；使用代理时应显示 `MANUAL · 127.0.0.1:端口`。

### 4.2 环境变量

「自动读取 Node 环境」时，按以下优先级取第一个非空值（小写变量优先于同名大写变量）：`HTTPS_PROXY` → `ALL_PROXY` → `HTTP_PROXY`。支持 `http://`、`https://`、`socks5://`、`socks5h://`，可在 URL 中携带认证信息。`NO_PROXY` 匹配 `api.github.com`（或为 `*`）时直连。

```bash
# macOS / Linux
HTTPS_PROXY=http://127.0.0.1:7897 npm run dev
ALL_PROXY=socks5h://127.0.0.1:7897 npm run dev
```

```powershell
# Windows PowerShell
$env:HTTPS_PROXY="http://127.0.0.1:7897"; npm run dev
```

注意：在 WSL / Docker 中运行时，`127.0.0.1` 指向容器自身而不是宿主机。

### 4.3 服务器部署下的代理：已锁定

部署时设置了 `VIGIL_PROXY_LOCK=1`：

- `GET api/github/proxy` 返回 `locked: true`；
- `POST api/github/proxy` 一律返回 **409 `PROXY_LOCKED`**。

原因：中继里的「本机代理」指的是**服务器自己的回环地址**，而不是访客电脑；设置又是所有访客共享的。访客电脑上的 Clash 7897 对服务器无效，**不要在服务器部署的页面里配置它**，保持「自动读取 Node 环境」直接连接仓库即可。服务器若确需代理，由管理员在 systemd 单元里设置环境变量。

---

## 5. 读写与 SHA 冲突

### 5.1 读取

- 目录列表只显示子目录和 Markdown 文件（目录在前，按中文排序）。Contents API 单目录最多返回约 1,000 项。
- 文件内容由 Contents API 以 Base64 返回（GitHub 对完整 Base64 内容的上限为 1 MB）；应用只处理不超过约 900 KB 的文件，更大或非 Base64 返回会报错。
- 文本按严格 UTF-8 解码；以 `\0GITCRYPT\0` 开头的文件按 git-crypt 密文处理（第 6 节）。

### 5.2 写入

- 只能写 Markdown 文件，需要 `Contents: Read and write` 令牌；无令牌时编辑内容只保存为本机草稿。
- 提交信息为 `docs: add <path> via Vigil` 或 `docs: update <path> via Vigil`，写入所选分支（留空则默认分支）。
- 每次保存前都会重新读取路径沿途的 `.gitattributes` 并校验 git-crypt 规则（第 6.3 节）。

### 5.3 SHA 乐观锁

- 打开文件时记录其 blob SHA，提交时随 PUT 一起发送；新建文件不带 SHA。
- 远端在此期间被修改时 GitHub 返回 **409**（路径/SHA 不匹配时可能是 422）：应用**不会覆盖远端**，编辑内容保留并存为本机草稿。请复制当前文字，刷新远端文件比较后再提交。
- PUT 遇到网络中断（连接断开、超时）时**绝不自动重试**：提交可能已经成功，只是响应没送达。请先在 GitHub 上确认文件是否已更新。
- 提交成功后刷新目录列表；列表刷新失败只提示，不会让你重复提交。

### 5.4 仓库草稿

在编辑器中修改仓库笔记时，草稿会自动保存在本机 `localStorage`（与本地手记草稿同一存储，键名为不含路径的哈希），并记录基于的 SHA。恢复草稿时若远端 SHA 已变化，会再次确认；恢复后提交仍走 SHA 检查。**注意：已解锁的 git-crypt 笔记，其草稿同样以明文保存在本机**（见第 8 节）。

---

## 6. git-crypt

### 6.1 格式与兼容性

- 与 VIGIL 自己的「加密 JSON 备份」（AES-256-GCM + PBKDF2 口令）是两套无关的机制，不能互换。
- 兼容 git-crypt 0.4–0.8 用 `git-crypt export-key` 导出的 **v2 对称密钥文件**，使用其中的 key version 0；不是口令，也不支持 GPG 解锁、多版本 key ring、`git-crypt init`。
- 密文格式：`\0GITCRYPT\0`（10 字节）+ 12 字节 nonce + AES-256-CTR 密文；nonce 为明文 HMAC-SHA1 的前 12 字节。解密后重新计算 HMAC 校验，不一致（错密钥或被篡改）即拒绝，不输出未经认证的明文。
- 实现依据 [git-crypt 源码](https://github.com/AGWA/git-crypt) 独立编写，用 Web Crypto 完成；需要 HTTPS 或 localhost 安全上下文。尚未用原生 git-crypt CLI 生成的真实仓库样本做互操作验收。

### 6.2 在仓库中使用

1. 在已解锁的本地仓库导出密钥：`git-crypt export-key /path/to/vigil.key`。
2. 连接仓库后点「导入密钥」，选择该二进制文件（≤ 1 MB）。密钥被导入为不可导出的 `CryptoKey`，原始字节随即清零；只在本页内存中存在，不写入任何存储。
3. 打开加密文件：未导入密钥时显示「这篇手记已加密」锁定界面；导入正确密钥后可阅读和编辑。
4. 提交时客户端先加密为 git-crypt 二进制，再以 Base64 + 原 SHA 提交；GitHub 上只出现密文，密钥不会离开浏览器。
5. 「锁定密钥」「断开」、切换到另一个仓库或刷新页面都会释放密钥。

**明文显示的含义**：应用只解密以 `\0GITCRYPT\0` 开头的 blob。如果某个文件在**未导入密钥**时就能以明文显示，说明它在 GitHub 上**就是以明文存储的**——要么没有被 `.gitattributes` 规则覆盖，要么是在 git-crypt 过滤器未生效时提交的。请在本地用 `git-crypt status` 检查并修复。

### 6.3 `.gitattributes` 防泄漏检查

GitHub REST API 不会执行本地 Git 的 clean/smudge 过滤器，所以应用在每次写入（以及新建笔记）前自行检查：

- 依次读取根目录及目标路径沿途每一级目录的 `.gitattributes`，后匹配的规则覆盖先匹配的；
- `filter=git-crypt` 或 `filter=git-crypt-<名称>` 表示该路径必须加密；`-filter` / `!filter` 取消；
- 路径要求加密但未导入密钥 → **拒绝明文提交**；
- 已是密文但规则未要求加密 → 拒绝提交（避免写入无法被 Git 自动解密的密文）；
- 命名密钥（`git-crypt-<名称>`）必须与导入密钥文件中的名称一致，否则拒绝；
- 带 git-crypt 过滤器的规则若使用 `[]`、`{}`、`\` 等不支持的模式，**停止自动提交**；
- `.git/info/attributes`、全局 attributes 等未提交到仓库的规则网页无法得知，必须在本地用 `git check-attr filter -- path/to/note.md` 核实。

### 6.4 本地文件工坊

「门与数据 → git-crypt 文件工坊」：导入 export-key 后，可把本地 Markdown（≤ 900 KB）**本地加密**为 `*.gitcrypt.md`，或把带 git-crypt 文件头的文件**本地解密**为 `*.decrypted.md`。结果只下载到本机，不修改 GitHub 仓库；上传前请确认 `.gitattributes` 规则。

---

## 7. 诊断与故障排查

### 7.1 三种诊断工具

| 工具 | 在哪里运行 | 能证明什么 |
| --- | --- | --- |
| 「测试 GitHub 网络」 | 页面 → 中继 `api/github/diagnose`（无中继时浏览器直连匿名读取示例仓库） | 中继所在机器能否经当前代理完整读取 GitHub JSON |
| 「浏览器链路检查」 | 当前浏览器并行请求四个公开地址：`api/github/diagnose`、`api/github/repos/octocat/Hello-World`、`api/vigil-bridge/repos/octocat/Hello-World`、`https://api.github.com/repos/octocat/Hello-World` | 当前页面的每条通道能否连通（`RELAY` 表示由中继响应） |
| `npm run diagnose:github` | 终端，对 `http://127.0.0.1:${VIGIL_PORT 或 PORT 或 5173}` 依次检查 health、proxy、diagnose、仓库信息、目录、备用通道 6 项 | Node 中继本身是否正常；**不能代替浏览器检查** |

三者都不使用令牌、不涉及私人仓库。连接失败时，错误下方可展开「**查看这次连接的实际请求阶段与通道**」，列出连接阶段、每条通道、环节（发送请求 / 检查响应头 / 读取 JSON / 校验状态）和状态码或错误码，不含地址、令牌或正文，可放心复制给维护者。

推荐顺序：测试 GitHub 网络 → 一键连接公开示例（匿名）→ 连接自己的仓库。公开示例成功而自己的仓库失败，问题在地址、分支、目录或令牌权限，而不在网络。

### 7.2 错误码速查

| 错误码 / 表现 | 来源 | 原因 | 处理 |
| --- | --- | --- | --- |
| `FETCH_REJECTED`（`Failed to fetch` / `Load failed`） | 浏览器 | 请求在发出前或连接层被拒：服务未运行、证书不受信、扩展拦截、CORS 失败 | 确认服务在运行、地址和端口正确；自签名 HTTPS 先在浏览器中信任证书；在无扩展窗口对照；查看开发者工具 Network |
| `JS_TYPE_ERROR` / `ILLEGAL_INVOCATION` | 浏览器 | 页面脚本或被替换的 `fetch` 出错，而非网络 | 硬刷新（Ctrl+Shift+R）确认未加载旧脚本；禁用改写 `fetch` 的扩展 |
| `TIMEOUT` | 浏览器 | 单条通道 15 秒无响应 | 查看中继终端日志；检查代理 |
| `LOCAL_RELAY_MISSING` | 客户端 | 中继路径的响应没有 `X-Vigil-Github-Proxy` 头：页面由其他静态服务器提供，或服务器上 nginx 因 `Origin` 不同源直接返回 403 | 本地用 `npm run dev` 打开；服务器上确认通过同一 `scheme://host:port` 访问页面 |
| `LOCAL_RELAY_ERROR`（HTTP 500） | 中继 | 中继内部未处理的异常 | 查看 `npm run dev` 终端 / `journalctl -u vigil` 中的 `[Vigil local relay]` 错误码 |
| `ORIGIN_DENIED`（HTTP 403） | 中继 | Host 不是回环地址或 `Origin` 不同源（例如直接用局域网 IP 访问未经 nginx 的端口） | 本地通过 `127.0.0.1` / `localhost` 打开；服务器经 nginx 访问 |
| `PROXY_LOCKED`（HTTP 409） | 中继 | 服务器部署锁定了代理设置 | 不要在服务器页面设置代理（第 4.3 节） |
| `PROXY_LOCAL_ADDRESS_INVALID` 等（HTTP 400） | 中继 | 代理主机不是回环地址或端口无效 | 只填 `127.0.0.1` / `localhost` / `::1` 与正确端口 |
| `ANONYMOUS_READ_ONLY`（HTTP 403） | 中继 | 对备用通道发送了令牌或写请求 | 正常不会出现；带令牌请求只走主通道 |
| `PATH_DENIED` / `BAD_AUTH` / `BAD_JSON` / `TOO_LARGE` | 中继 | 路径不合规、令牌格式不对、提交正文无效或超过 3 MB | 检查路径与令牌；缩小文件 |
| `GITHUB_TIMEOUT`（HTTP 502） | 中继 | 中继访问 GitHub 超时 | 检查代理端口与节点；可试 SOCKS5 |
| `GITHUB_UNREACHABLE` + `ECONNREFUSED` | 中继 | 代理端口无人监听 | 确认代理软件运行、端口和 HTTP/SOCKS 类型 |
| `… + ENOTFOUND` / `EAI_AGAIN` | 中继 | 中继所在机器 DNS 解析失败 | 检查 DNS，或用 SOCKS5（远程 DNS） |
| `… + PROXY_CONNECT_407` / `PROXY_CONNECT_*` | 中继 | HTTP 代理拒绝 CONNECT（407 需认证） | 检查代理规则；需认证的代理用环境变量配置 |
| `… + PROXY_TIMEOUT` / `PROXY_EOF` | 中继 | 代理握手超时或中途断开 | 检查代理是否卡死、端口类型是否选对 |
| `… + SOCKS_AUTH_*` | 中继 | SOCKS5 认证失败或方式不匹配 | 页面仅支持无认证本机代理 |
| `… + SOCKS_CONNECT_n` | 中继 | SOCKS5 拒绝连接 GitHub | 检查节点与分流规则 |
| `… + CERT_*` / `UNABLE_TO_VERIFY_LEAF_SIGNATURE` | 中继 | TLS 证书校验失败（常见于企业 HTTPS 中间人） | 配置正确的 CA；**不要关闭证书校验** |
| `… + UNSUPPORTED_PROXY` / `BAD_PROXY_URL` | 中继 | 代理环境变量格式或协议不支持 | 改为 `http://`、`https://`、`socks5://`、`socks5h://` |
| `GITHUB_INVALID_RESPONSE` | `diagnose` | 收到响应头但 JSON 不完整 / 不是仓库数据 | 代理截断了正文；换代理模式或节点 |
| `INVALID_JSON_BODY` / `INVALID_REPOSITORY_JSON` / `INVALID_DIRECTORY_JSON` | 客户端 | HTTP 200 但正文损坏或结构不对 | 同上；匿名读取会自动尝试下一通道 |
| HTTP 401 | GitHub | 令牌无效或过期 | 重新签发；公开仓库可勾选匿名读取 |
| HTTP 403 | GitHub | 权限不足、组织 SSO 未授权，或 API 额度耗尽（`X-RateLimit-Remaining: 0`） | 检查 Contents 权限与 SSO；额度耗尽则稍后再试或使用令牌 |
| HTTP 404 | GitHub | 仓库/分支/目录/文件不存在，或私有仓库未授权 | 先连公开示例，再核对地址、分支、目录和令牌范围 |
| HTTP 409 | GitHub | 远端文件已变化（SHA 冲突） | 见第 5.3 节 |
| HTTP 422 | GitHub | 路径、分支、SHA 或请求内容不符合 API 要求 | 核对分支是否存在、文件 SHA 是否最新 |
| 「本地同源通道提交连接中断」 | 客户端 | PUT 网络中断 | 先确认远端是否已更新，再决定是否重新提交 |
| 「匿名仓库三个通道均未连通」 | 客户端 | 主、备、直连都失败 | 按展开的请求阶段逐条排查 |
| 「仓库 .gitattributes 含不支持的 git-crypt 模式」 | 客户端 | 规则含不支持的通配 | 简化规则，或在本地用 Git 提交 |
| 「路径匹配 git-crypt 规则，已禁止明文提交」 | 客户端 | 未导入密钥 | 导入对应 export-key |

### 7.3 常见情形

- **CLI 全部 PASS、浏览器失败**：问题在浏览器侧——扩展拦截、旧缓存、实际打开的地址/端口与运行中的服务不一致。硬刷新、无痕窗口对照、看 Network。
- **浏览器链路检查四项 PASS、连接仍失败**：展开「实际请求阶段与通道」，按阶段和错误码定位；无需再改代理。
- **服务器上 Safari 报 `FETCH_REJECTED`**：确认已信任服务器证书，且页面是最新版本（中继请求须为 `same-origin` 凭据）。
- **可以连接公开示例，个人仓库不行**：核对仓库地址、分支、目录、令牌的 Contents 权限与组织 SSO，以及是否误勾了匿名模式。

---

## 8. 安全边界

- **令牌**：只在页面内存；不落盘、不进入请求追踪或日志。仅发送给 GitHub（直连）或同源中继（再转发给 GitHub）。请在可信的 localhost 或 HTTPS 部署下使用，不要在公共电脑或陌生网页输入令牌。本应用没有 OAuth 登录。
- **git-crypt 密钥**：不可导出的 `CryptoKey`，只在页面内存；不会上传。不要把 export-key 提交到仓库、发到聊天或不可信网页。
- **本机草稿是明文**：编辑仓库笔记时的自动草稿（包括已解锁的 git-crypt 笔记）保存在本机 `localStorage`，不加密。在共用设备上编辑加密笔记后，请提交或删除草稿。
- **中继不是开放代理**：只允许 `api.github.com` 的仓库与 Contents 路径、GET/PUT、`ref` 查询；备用通道只读且拒绝令牌；不关闭 TLS 证书校验；不记录令牌、正文或仓库地址。
- **同源**：本地由中继校验回环 Host 与 Origin；服务器上由 nginx 校验 Origin、剥离 Cookie，中继只监听 `127.0.0.1`。
- **代理设置**：页面只能指定本机回环代理；服务器部署时完全锁定（`PROXY_LOCKED`）。
- **写入安全**：SHA 乐观锁防覆盖；PUT 不自动重试；带令牌的请求和写入从不回退到其他通道；git-crypt 规则阻止明文提交受保护路径。
- **诊断**：所有诊断只访问公开示例 `octocat/Hello-World`，不使用令牌。

## 参考

- GitHub Contents API：<https://docs.github.com/en/rest/repos/contents>
- Fine-grained 令牌所需权限：<https://docs.github.com/en/rest/authentication/permissions-required-for-fine-grained-personal-access-tokens>
- git-crypt：<https://github.com/AGWA/git-crypt>
- 测试：`tests/github*.test.js`、`tests/git-crypt.test.js`

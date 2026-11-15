# git-crypt 本地和 GitHub 文件加解密 · 1.5

## 两种不同加密机制

1. **VIGIL 加密 JSON 备份**：应用 v1.4.1 自有格式，AES-256-GCM + PBKDF2。使用用户口令生成备份文件，不能与 git-crypt 互换。
2. **git-crypt 加密 Markdown**：匹配 `\0GITCRYPT\0` 文件头，后跟 12 字节 nonce 和 AES-256-CTR 密文。nonce 由 HMAC-SHA1(明文) 的前 12 字节决定。导入的是原生 `git-crypt export-key` 二进制**对称密钥文件**，不是直接输入密码。

`src/security/git-crypt.js` 参照 [git-crypt 官方源代码](https://github.com/AGWA/git-crypt) 的文件头、版本零密钥、AES-CTR counter 与 HMAC nonce 方案独立实现。已用 Node OpenSSL 算法独立生成的字节序列验证输出一致，并验证篡改、错密钥被拒绝；**尚未使用一份由原生 git-crypt CLI 实际生成的真实仓库样本进行互操作验收**。这一点在 QA 报告中单列。

## 在已有仓库里使用

1. 在自己的电脑或已解锁仓库里导出密钥：`git-crypt export-key /path/to/private.key`。
2. 在 VIGIL 进入「GitHub 仓库」，填写现有仓库、可选分支与笔记目录；公开仓库匿名只读，修改/私有仓库需具备 Contents 读写权限的 fine-grained PAT。
3. 通过「导入密钥」选择自己导出的**二进制 key 文件**，保留在当前浏览器页面内存中，不写入 localStorage、IndexedDB 或 JSON 导出。
4. 点击仓库中的 `.md` / `.markdown` 文件，若二进制文件头是 git-crypt，解密前显示锁定界面；导入正确密钥后显示 Markdown 预览与编辑。
5. 编辑并点击提交，客户端**先按 git-crypt 格式加密成二进制密文**，再通过 GitHub Contents API 按 Base64 和原 blob SHA 提交；409 冲突会保留用户文字。
6. 点击「锁定密钥」或断开仓库连接，移除当前页面的 CryptoKey 对象引用。刷新页面也会失效。密钥不会传到 GitHub，只有密文被提交。

### 关于 .gitattributes 的防泄漏检查

- **GitHub REST API 不会替代本地 Git 的 clean/smudge 过滤器。** 因此写入前检查仓库根目录与路径沿途的 `.gitattributes`，只允许匹配 `filter=git-crypt`（或有名字的 `filter=git-crypt-NAME`）规则的路径提交加密内容。受保护路径不允许明文写入。
- 对命名密钥，导出密钥中的 `keyName` 必须与属性规则中的名称一致。
- 匹配属性中包含无法确认的复杂通配模式时会**停止自动提交**，避免误判；更复杂的实际 Git 属性继承请在本机使用 `git check-attr filter -- path/to/note.md` 核验。
- 若仓库使用 `.git/info/attributes`、条件文件或其他本地未提交规则，网页无法得知这些隐藏的本地规则，必须在本地核实；此客户端不会假设一切路径都已加密。
- 仅处理小于约 900KB 的 UTF-8 Markdown。暂不支持 GPG 私钥解锁流程、多版本 git-crypt key ring、目录递归大批量解密或 `git-crypt init`。

## 本地文件工坊

在「门与数据 → git-crypt 文件工坊」：先导入 export-key，选择本地 Markdown 文件执行**本地加密**，或选择带有 `\0GITCRYPT\0` 文件头的加密 Markdown 执行**本地解密**。解密必须通过 HMAC 验证才下载文件，失败时不会输出未经认证的明文。输出文件只保存到用户自己设备，不修改 GitHub 仓库。

## GitHub API 连接检查

连接后点击「检查连接」，会重新获取仓库元信息、所选分支/目录文件及根目录 `.gitattributes`，并展示结果。支持 401 / 403 / 404 / 409 / 422 明确错误反馈。

API 对照 [GitHub 官方 Contents API](https://docs.github.com/en/rest/repos/contents)：

- `GET /repos/{owner}/{repo}` — 仓库元信息；
- `GET /repos/{owner}/{repo}/contents/{path}?ref={branch}` — 浏览目录与 Base64 文件内容；
- `PUT /repos/{owner}/{repo}/contents/{path}` — 提交文件，含提交消息、Base64 字节、分支及旧 SHA；
- `X-GitHub-Api-Version: 2026-03-10`；
- 公开资源匿名可读，写入需要 Contents 写权限；Contents API 目录列表上限为 1000 项，单个文件完整 Base64 读取限于 1 MB。

**隐私警示：不要把 export-key 上传到仓库、发送给不可信网页或复制进聊天。** VIGIL 只在浏览器内存中临时导入密钥，在可信 localhost/HTTPS 下使用。由于旧版本的加密协议不明，此能力不能解密任何未经过验证的其它程序加密 JSON。

# GitHub 仓库编辑使用指南

## 使用流程

在「GitHub 仓库」页面：

1. 输入现有仓库的地址：`https://github.com/owner/repo`。
2. 按需填写分支；留空使用 GitHub 的默认分支。
3. 可指定笔记目录（例如 `notes`）；留空为仓库根目录。
4. **公开仓库只读预览不需要令牌**。需要编辑、新建 Markdown 或访问私有仓库时，再填写 fine-grained Personal Access Token。
5. 连接后浏览文件夹，点击 `.md` / `.markdown` 文件即可预览。进入编辑模式并点击「提交到 GitHub」，会创建一次 Git 提交。

## Token 应有哪些权限？

在 GitHub 的 fine-grained personal access token 创建页面选择**单个目标仓库**，将 Repository permissions 的 `Contents` 设为 `Read and write`。只读时可设为 `Read-only`。尽量不要授权全账号或其他仓库。

本应用的浏览器代码只把 Token 保存在当前页面的 JavaScript 内存中，不写入 `localStorage`、`sessionStorage`、浏览器数据库或下载文件。页面刷新后需要重新提供 Token，点击「断开」会立刻清除内存中的 Token。

**请在你信任的本地或 HTTPS 部署下使用 Token**。这一版没有服务器 OAuth 登录方案。不要在陌生网页或公共计算机上输入你的 Token。

## 支持的行为与范围

- 浏览现有文件夹、Markdown 文件。
- 使用 GitHub API UTF-8/Base64 读取和写入单个 Markdown 文件。
- 新建 `.md` / `.markdown` 文件，提交到指定分支。
- 编辑文件时携带读取时的 `sha`；远端文件变化导致冲突时，**不会自动覆盖**，你在编辑框的文字仍保留。
- Contents API 一次仅列出当前目录，单目录上限约 1,000 项；大规模仓库可以进一步换用 Trees API。
- 当前只处理不超过约 900 KB 的编辑文件；大型或二进制文件不适用。
- GitHub 不与本地手记库自动同步，本地 JSON 备份也不包含远端 GitHub 文件。仓库有自己的 Git 提交历史。

## 常见错误

- **401**：Token 无效或已过期。
- **403**：权限不足或 API 频率受限。
- **404**：仓库、分支或文件不存在；私有仓库也可能是授权不足。
- **409**：编辑期间文件已经发生变化；请复制当前文字、刷新远端后再比较。
- **422**：文件路径/分支或请求内容不符合 API 要求。
- **网络失败**：可能是离线、企业网络阻断或浏览器策略。原型不会声称提交成功。

## 参考

GitHub 官方文档：[Repository Contents REST API](https://docs.github.com/en/rest/repos/contents)。

实现文件：`src/github/api.js`；测试：`tests/github.test.js`。

# v1.7.0 · 验收报告与复现边界

## 自动化检查

| 项目 | 结果 | 方法 |
| --- | --- | --- |
| Node 单元测试 | **169 / 169 通过** | `npm test`，含 v1.7.0 新增的 7 组 Markdown 与远端文库测试 |
| 离线 Chromium 完整操作断言 | **25 / 25 通过** | `python scripts/qa-browser-170.py`，模拟授权 GitHub JSON API |
| 双文库入口 | 通过 | 本地手记 / GitHub 仓库作为同级页签 |
| 目录与搜索 | 通过 | 连接后自动展示仓库、Markdown 卡片、子文件夹 |
| 完整阅读与编辑 | 通过 | GitHub 文件进入本地共用阅读稿纸和 CodeMirror 三态编辑器 |
| SHA 更新与冲突保护 | 通过 | 成功 PUT 提交原 SHA；409 时留在编辑器并保存本机草稿 |
| 新建仓库 Markdown | 通过 | 在共享编辑器创建，首次 PUT 不携带旧 SHA |
| H1–H6、Callout / Quote、字体样式 | 通过 | 单元渲染测试 + 真实 Chromium 阅读模式截图与 DOM 断言 |
| 手机适配 | 通过 | 390px 与 1440px 无横向溢出，未发现运行时 JS 错误 |
| 旧文库数据格式 | 未改变 | 复用 `vigil-mvp-data-v1` 等现存键与 schema v1 |
| git-crypt 保护 | 通过逻辑回归 | 写入前检查属性规则；密文加密仍由现有安全模块处理 |

### 用到的可控 GitHub 模拟 API

- `GET /repos/demo/journal` → metadata；
- `GET /repos/demo/journal/contents/notes` → 含中文路径的文件/目录；
- `GET /repos/demo/journal/contents/notes/薄暮.md` → Base64 Markdown；
- `PUT ...` → SHA 更新；模拟 409 服务器冲突，不把失败当成功；
- 新 Markdown `PUT .../新手记.md` → 首次提交不附带旧 SHA；
- `.gitattributes` 不存在返回 404 测试未加密仓库路径。

所有模拟 Token 都是无效测试字符串；没有请求用户的私有 GitHub 账号。浏览器测试在本地离线 fixture 中运行（Chromium 不能通过当前环境策略访问本机 dev server），与在实际用户网络连接 GitHub 的验收**不是一回事**。

## 运行环境

- Node.js 22，`node --test`；
- Chromium headless，Playwright Python 驱动；
- CSS 单文件由 `npm run build:css` 根据 `scripts/style-order.json` 重新生成；
- 设计预览位于 `docs/preview-170-*.webp`，并非伪装的部署截图；
- 实际 GitHub 读写、组织权限、Clash/SOCKS5 节点与原生 `git-crypt` 互操作仍需要用户在本机验证。

## 本地复现与验收建议

1. 在开始正式升级前，进入「设置 → 数据」导出一份 JSON 或加密备份。
2. 运行 `npm run dev`，打开 `http://127.0.0.1:5173/`，确认之前的手记仍在。
3. 进入「GitHub 仓库」，选目标仓库与目录，使用你自己的 Fine-grained PAT；不必重配原本能正常工作的代理。
4. 连接成功应自动跳转「全部手记 → GitHub 仓库」，点击 Markdown 文件后读写与本地体验一致。
5. 编辑含 `####`、Callout、引用、`<span class="font-kai">` 的手记，切换实时 / 阅读 / 源码。
6. 测试修改并提交，检查 GitHub 提交 SHA 与页面一致；不需要为验证而提交真实私人资料到公开仓库。
7. 对加密仓库额外测试导出密钥的解锁与规则校验；不要向任何人发送 Token 和密钥。

## 已知限制

- GitHub 文件名对应远端路径，暂不支持一键重命名；远端文库不自动镜像成本地正式手记。
- Obsidian HTML/CSS 兼容受安全白名单约束，不保证运行社区 CSS snippet 或插件。
- 并未操作真实外部账户；若生产部署的代理或 GitHub 权限有差异，依然可能出现与模拟不同的 HTTP 错误。

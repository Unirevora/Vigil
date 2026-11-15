# v1.5.4 · 发布与浏览器测试记录

## 单元测试

`npm test`：**93/93 通过**。在 1.5.3 的 87 项基础上新增 6 项 `tests/chronicle-154.test.js`：

- 合并日历/节气页签的语义与默认视图；
- 节气盘嵌入不重复页面标题、所选日期正确；
- 旧 view 仍可独立渲染并支持嵌入模式；
- 设置第五个「关于」页签、版本和数据说明；
- 本地环境诊断正常与失败分支，确保摘要不会泄露正文、仓库、Key；
- 存储被保护时不误判为可写。

另外逐个通过了所有 `src/*.js` 的 Node 语法检查、相对模块引用校验。

## 浏览器回归

在 320、390、768、1024、1440、1672px 六种尺寸下，基于真实源模块、KaTeX/CodeMirror vendor 和项目 CSS 装配的离线 Chromium 测试夹具，每种宽度 **27/27 断言通过**，共 **162/162**：

- 首页、手记列表、编辑器、阅读页、日历与风物（两个页签）、设置外观、设置数据、关于、线索、GitHub 连接入口；
- 新建手记、输入 Markdown、在三态编辑器中切换、保存/阅读；
- 主题色变化仍更新毛玻璃侧栏；
- 本地诊断运行、关于页存在；
- 320px 至宽屏所有主要页面无横向溢出；
- 桌面不出现底部 Dock；移动版合并页可以显示快捷 Dock；无脚本异常。

此外桌面 1440 与手机 390 的专项 **35/35 断言**也通过：顶栏不再包含 `V.` / 透明顶栏无 blur、圆角页签非全宽、关于诊断、双页签日期联动、箭头切换、回到今天。

另外项目自带 HTTP 开发服务器已在 loopback 返回首页、新增 JS 模块、CSS 和说明文档的 HTTP 200；修正了 Markdown 文档的 `text/plain` 类型，以便「关于」链接直接阅读。

**重要限制：** 本次自动化环境的 Chromium 网络导航受到管理员阻断（包含 localhost），所以使用内联组合的真实源模块与 CSS 进行离线 GUI 检查，模拟了可写 localStorage。浏览器安全上下文中的 `crypto.subtle`、实际 HTTP ES Modules 加载、真实 GitHub API 和 git-crypt 的私人仓库互操作**未在本轮完成端到端验证**。这些功能沿用已有测试与源码，不应把离线 GUI 检查当作真实连接成功。部署时应在 `localhost` 或 HTTPS 下复验。

## 对照截图

- `preview-154-home-1440.png`：清爽顶栏、保留复古文房与毛玻璃侧栏
- `preview-154-settings-1440.png`：五圆角页签与安静的设置纸面
- `preview-154-about-390.png`：手机关于页
- `preview-154-calendar-1440.png`：统一日历归档
- `preview-154-chronicle-1440.png`：节气风物同页切换
- 同名 `-390.png`：390px 手机适配截图

## 版本与数据兼容

`package.json` 与侧栏发行标识升级为 `1.5.4`。正式手记 Schema、浏览器 Key、历史备份、CodeMirror/KaTeX、GitHub SHA 安全写入与 git-crypt 均未更换或静默迁移。

## 本地真实 HTTP 回归命令

另附 `scripts/qa-browser-154.py`，开发者可以在允许本机 HTTP 的环境下再次验证真实的 ESM 资源请求和浏览器交互。此脚本使用随机空闲端口启动项目自带的 Node 服务器，不会访问用户的 GitHub 仓库：

```bash
pip install playwright
python -m playwright install chromium
python3 scripts/qa-browser-154.py
```

该可选脚本**未在当前受限沙箱中执行成功**（Chromium 导航被管理员策略禁止），不能用它虚报本轮测试覆盖。此前记录的 162+35 条断言来自真实代码组合的离线夹具，而非此命令。

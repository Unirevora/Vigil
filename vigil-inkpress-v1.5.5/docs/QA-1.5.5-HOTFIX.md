# v1.5.5 补丁验证记录（版本号不变）

- `npm test`：104/104 项通过，包含 5 项新增测试；没有修改 `package.json` 版本。
- 浏览器：在 Chromium 离线 HTML 夹具中装配项目代码和样式，运行了 16/16 项功能及布局检查。
- 实测包括：深色基底 `rgb(24, 25, 30)`、夜间石墨灰侧栏、朱砂 Logo 的图片加载、默认关闭画布、开启后像素绘制、强度写入偏好、禁用后隐藏、关于页标识、390px 移动端横向溢出和减少动态效果设置。
- 新画布开启时 1440×900 像素抽样包含数万个非透明像素，确认不是只有 CSS 背景、模糊或空画布。
- 检查期间没有发现浏览器运行时 JS 异常。
- HTML 夹具属于真实 JS、CSS、资产的离线装配，**不等价于用户生产环境里的 localhost/HTTPS 实际运行验收**。
- 未连接用户的私人 GitHub 仓库，也未验证 GitHub / git-crypt 的个人凭据互操作；相关模块保持原项目实现，不在本次修复范围。
- 字体二进制不随交付 ZIP 分发，继续保留本地字体恢复工具。

截图：`preview-155-hotfix-day.png`、`preview-155-hotfix-night.png`、`preview-155-hotfix-settings.png`、`preview-155-hotfix-mobile.png`。

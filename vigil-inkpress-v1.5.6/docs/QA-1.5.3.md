# VIGIL 1.5.3 · 回归记录

## 执行结果

- `npm test`：**87 项 Node 单元测试全部通过**，包含新增的设置分组、主题色侧栏派生、配置规范化、旧偏好兼容等 6 项测试。
- 离线 Chromium `scripts/qa-153.py`：**40 项页面交互与布局检查通过**（第一次完整回归）。后续调整了页签箭头键逻辑和界面遮罩，使用独立 Chromium 场景继续核对键盘 Home/End/箭头键、颜色圆点选中标记和选择器状态；均通过。
- 专项 Chromium 验证：**梅紫主题 → 经典墨绿侧栏切换、夜间玻璃文字对比、关闭动效偏好、编辑器心情新式下拉、单窗 CodeMirror** 均通过，未记录到页面运行时异常。
- 320、390、768、900、1024、1440、1672px 的首页及四类设置标签页面未发现横向溢出；下拉浮层保持在可见视口内。
- 项目全体 JS/MJS 语法检查及 ESM 相对路径引用核对均已执行。

## 视觉截图

以下均来自实际 Chromium DOM 渲染，而非设计合成图。

- `preview-153-settings-appearance.png`：桌面设置主页、扁平化页签和高清背景预览。
- `preview-153-blue-sidebar.png`：切换黛蓝主题后的侧栏、主操作与风格一致性。
- `preview-153-interaction.png`：新侧栏材质、玻璃浓度、动效设置。
- `preview-153-settings-data.png`：数据设置中的加密备份、git-crypt 与本地历史。
- `preview-153-settings-mobile.png`：390px 移动端设置页面。

## 自动化环境

当前 Chromium 环境禁止页面跳转到 localhost 与外部测试主机，浏览器专项采用 `scripts/make-inline-qa.py` 将项目真实 ES Modules 临时装配进内存 HTML 并 `page.set_content()`。**这仅是测试夹具**，交付项目仍是独立 HTML、CSS、JavaScript 文件。项目自带开发服务器的逻辑未修改。

`qa-153.py` 依赖 Python Playwright 和本地 Chromium，非项目运行依赖，安装不完整时可先运行 `npm test`。正式启动仍是 `npm run dev`。

## 尚未覆盖的环境

- Safari、Firefox 中带色玻璃的准确混合方式和不支持 backdrop-filter 的设备，需要实机检查。提供可读的实色降级。
- 真正私人 GitHub 仓库的连接和提交、真实 `git-crypt export-key` 的互操作依赖用户授权/密钥，未在本版执行。
- 原有 v2.8.2 的未知历史加密文件仍未做无样本迁移。
- 自定义图片上传到 IndexedDB 在当前自动化过程中未重新进行完整大文件压力测试；原模块未修改。

## 数据安全边界

**本次不修改**正式手记 `vigil-mvp-data-v1`、草稿、五份备份、口令加密 JSON、GitHub PAT 生命周期与 git-crypt 文件格式。外观偏好继续存储在 `vigil-appearance-v142`，旧版配置读取时自动填入新增可选属性。

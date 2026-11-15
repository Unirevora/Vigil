# v1.5.5 快速维护补丁 · QA 记录

> 本次不修改 `package.json` 版本号，仍为 **1.5.5**。

## 自动化测试

- `npm test`：**105 项通过，0 失败**。
- Node 语法检查：`src/effects/spectral-drape.js` 与 `src/main.js` 通过。
- 保留既有存储、Markdown/KaTeX、GitHub/git-crypt、日历、编辑器及数据测试。

## Chromium 离线夹具检查

| 检查 | 结果 | 细节 |
| --- | --- | --- |
| 夜间模式 | 通过 | 页面背景 `#18191e`；侧栏为中性石墨 `#26272c` → `#191a1f`，不再沿用日间松绿 |
| Logo | 通过 | 主标识 SVG 加载成功；关于页和 favicon 使用同一套朱砂印记 |
| 点阵帷幕默认状态 | 通过 | 默认 `hidden=true`，无动画帧持续运行 |
| 点阵帷幕开启 | 通过 | Canvas 可见、点阵像素非透明、按设置强度绘制 |
| 点阵帷幕关闭 | 通过 | 画布清空、隐藏并停止动画帧 |
| 减少动态效果 | 通过 | 系统偏好启用时只绘制静态帧 |
| 页面隐藏/恢复 | 通过 | `visibilitychange` 时暂停/恢复 |
| 响应式宽度 | 通过 | 320、390、768、1024、1440、1672px 无横向溢出 |
| 手机导航 | 通过 | 默认收起，按钮可展开；页面内容仍可操作 |
| JavaScript 运行时错误 | 通过 | 本轮 Chromium 场景未记录 pageerror |

## 视觉与实现说明

- `vigil-155-hotfix.css` 覆盖夜间色阶，侧栏在深色模式中采用中性石墨色，白天的墨绿与用户主题色逻辑不变。
- `vigil-mark.svg` 为矢量朱砂印记，几何笔画不依赖用户字体；`vigil-favicon.svg` 为浏览器标签适配版本。
- `spectral-drape.js` 是独立 Canvas 2D 原创视觉演绎：点阵透视、曲面折叠、微光点、DPR 限制、30fps 上限、页面隐藏暂停、减少动态效果静态化。
- 不安装 `@reactbits-starter/spectral-drape-tw`，也不复制 React Bits Pro 付费组件源码；不需要 Pro registry 或 license key。
- 设置保存在既有 `vigil-appearance-v142` 偏好对象中，默认关闭，不更改手记 Schema、草稿、备份、GitHub 或 git-crypt 格式。

## 未验证项

- 本轮浏览器验证使用真实项目模块组成的离线 Chromium 夹具；当前环境的 HTTP 导航受策略阻断，未把夹具验证冒充为真实 localhost 部署验证。
- 未在 Safari / Firefox 中测量 Canvas 性能；这些浏览器会使用标准 Canvas 2D，无需 SVG 位移滤镜。
- 未连接用户私人 GitHub 仓库；本次补丁未修改 GitHub API、Token 或 git-crypt 逻辑。

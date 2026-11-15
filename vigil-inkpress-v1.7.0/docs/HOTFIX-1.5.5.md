# 1.5.5 维护修复 · 石墨夜色、朱砂新印与点阵帷幕

本补丁**不变更应用版本**，`package.json`、诊断版本号和 UI 页脚仍为 `1.5.5`。
基于 v1.5.5 既有多文件架构调整，不修改正式手记 Schema、草稿、备份、GitHub 或 git-crypt 格式。

## 01 · 深色模式去绿

- 通过 `src/styles/vigil-155-hotfix.css` 统一覆盖以往主题层留下的青绿底色。
- 石墨黑页面底 `#18191e`、深灰内容卡 `#292b31`、暗灰纸面和浅暖灰正文。
- `sidebarPalette()` 夜间始终生成中性石墨色侧栏，而不是从主题色再混出墨绿；选中菜单仍使用设置里的主题色。
- 默认朱砂在暗背景上自动提高明度以保证阅读对比；按钮实色与存储的主题色保持一致。
- 夜间背景图做去饱和与亮度抑制，写作、阅读及数据卡保持实色。
- 白天的复古墨绿侧栏与原本所有自选颜色均保留。

## 02 · 统一品牌 Logo

- `assets/vigil-mark.svg`：重新绘制的朱砂双线印框、几何「眠」字与一枚小朱砂点；不依赖外部分发的字体文件。
- `assets/vigil-favicon.svg`：浏览器标签专用的紧凑应用标识。
- 同一标识用于展开/折叠导航及「关于」页；触屏适配不同尺寸，保留原来的「不眠手记」字标。
- 两枚 SVG 都是矢量素材，可无限缩放。

## 03 · 点阵帷幕（原创视觉演绎）

在「**设置 → 外观 → 背景**」找到 **Spectral Drape / 点阵帷幕** 开关与「光点强度」滑杆。

- 默认关闭，避免旧用户突然出现持续动画。
- 开启时由独立 Canvas 2D 模块绘制具有透视深度、折叠曲率与稀疏微光的点阵帷幕；背景位于内容层后面，不阻挡点击。
- 滑杆范围 15–85%，与开关一并保存到现有 `vigil-appearance-v142` 设置对象，不修改手记记录。
- 关闭时清空画布并停止动画帧；页面隐藏时暂停，显示后恢复；最多约 30 FPS、限制 DPR 与点密度。
- 响应 `prefers-reduced-motion`：系统要求减少动态效果时绘制静止的点阵，不再循环动画。
- 保留原有高清背景图片、自选上传、毛玻璃和暗色主题。

### 授权说明

本次添加的是**由视觉描述出发独立编写的原生 JavaScript Canvas 效果**，不是 React Bits Pro 的 `@reactbits-starter/spectral-drape-tw` 组件，也没有下载、提取或分发付费实现源码。

官方页面：<https://pro.reactbits.dev/docs/components/spectral-drape>。
官方组件需要 React Bits Pro 授权、正确配置的私有组件仓库以及适配 React 的构建环境。本网站当前是原生 ES Modules 项目，因此未执行 `npx shadcn ...` 命令。若以后已经购买授权并确定迁移到 React，可再单独接入官方实现。

## 文件变更

- `index.html`：Logo、favicon、背景 Canvas、补丁 CSS 引用。
- `src/main.js`：新背景运行器、设置持久化、暗色强调色可读性。
- `src/appearance/settings.js`：新背景偏好/强度、石墨侧栏计算。
- `src/effects/spectral-drape.js`：独立画布视觉模块。
- `src/ui/views/settings.js`：背景开关与光点强度。
- `src/ui/views/about.js`：新 Logo。
- `src/styles/vigil-155-hotfix.css`：统一暗色材质、Logo 与背景控件样式。
- `assets/vigil-mark.svg`、`assets/vigil-favicon.svg`：品牌资源。
- `tests/hotfix-155.test.js`：5 项专项回归测试。

### 手动检验

```sh
npm test
npm run dev
```

打开本地开发站后，切换深色模式，进入「设置 → 外观 → 背景」开关点阵帷幕并调整强度；刷新页面应能恢复设置。建议再检查手机菜单和系统减少动态效果偏好。

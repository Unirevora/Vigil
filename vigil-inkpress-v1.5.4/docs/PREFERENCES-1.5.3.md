# v1.5.3「澄墨」· 设置、主题与玻璃材质

## 设计目标

不抛弃 v1.1 至 1.5.2 的复古墨绿文房、朱砂印记、打字机、纸张和高清风景；但需要解决：

- 旧「外观 / 数据」选项卡是大尺寸卡片，层级沉重且不易扩展。
- 原生 `select` 弹出系统级菜单，与整站字体、圆角、颜色和响应式不一致。
- 主题色只影响部分强调元素，侧栏却始终是写死的绿色。
- 左侧导航是实色涂层，未真正用模糊表现背后的背景。

## 本版交互

设置采用 **4 个平铺文字页签**（外观、排版、交互、数据），只用下划线指示选中态。没有嵌套页签卡片。配置内容放在统一的稳定纸面上，用细分隔线代替重复的立体卡片。

| 页签 | 控制 | 行为 |
| --- | --- | --- |
| 外观 | 日夜主题、6 种主题色、自定义颜色 | 点击立刻更新 UI、侧栏和控件，写入原外观偏好键 |
| 外观 | 6 种背景、自定义上传、背景强度、纸面透光 | 沿用独立 IndexedDB 图片存储；背景不进入手记备份 |
| 外观 | 默认静物、自定义首页照片 | 原打字机视觉和自定义素材保持可切换 |
| 排版 | 字体、字号、行高、版心宽度、纸张纤维 | 长文继续采用稳定实色阅读面板 |
| 交互 | 侧栏随主题色 / 经典墨绿 | 默认跟随主题色；如特别喜欢旧墨绿可手动固定 |
| 交互 | 侧栏着色浓度、模糊程度、浮层着色浓度 | 动态更新 CSS 变量，可实时预览 |
| 交互 | 轻盈回弹 / 更克制 / 关闭动效 | CSS 与页面入场 WAAPI 同时适配；仍优先遵守系统减少动态效果 |
| 数据 | 明文/口令 JSON 导入导出、五份备份、草稿、git-crypt 本地工坊 | 复用原有逻辑，不修改数据结构及加密协议 |

`ArrowLeft`、`ArrowRight`、`Home`、`End` 支持在设置页签之间切换；手机上的页签保持单行可水平滚动，不出现横向页面溢出。

## 主题色扩展

`src/appearance/settings.js` 中的 `sidebarPalette()` 生成侧栏顶/底色、被选中项的浅纸底色、边框色阶。`src/main.js::applyAppearance()` 将它们映射为：

- `--sidebar-glass-top` / `--sidebar-glass-bottom`
- `--sidebar-solid`：不支持模糊与减少透明度偏好下的稳定后备颜色
- `--sidebar-accent-ink` / `--sidebar-edge`
- `--sidebar-glass-blur`：真实 `backdrop-filter` 模糊强度
- `--glass-material` / `--glass-foreground`
- `--user-primary-bg` / `--appearance-contrast` / `--green` / `--green-soft`
- `--appearance-accent` / `--accent` / `--accent-soft`

默认侧栏跟随当前主题色生成**低明度深色调**：朱砂偏深暖棕、黛蓝偏深海蓝、梅紫偏灰紫、松绿偏墨绿。这样保留东方复古气氛，同时不会换主题却仍固定绿侧栏。暗色主题独立计算深色阶。

## 毛玻璃实现

- **侧栏**：半透明的深色梯度 + `backdrop-filter:blur(var(--sidebar-glass-blur)) saturate(1.35)` + 单侧高光 + 原有山水纹样；保持导航文字对比。
- **按钮、浮层、顶部栏、编辑器格式菜单**：复用原 1.5 的液态玻璃层，并用由主题色微染的 `--glass-material` 配合边缘高光。
- **正文、长表格、设置的数据内容**：保持不透明或高遮罩度实色面，不额外加入折射和闪光。
- **不可用时降级**：`@supports not(backdrop-filter)` 和 `prefers-reduced-transparency` 下侧栏退回不透明深色，避免漂白文字。
- 原项目已有的 SVG 位移滤镜 + Canvas 边缘折射保留，适用于现有 `data-liquid-glass` 控件；**整面侧栏使用高效 CSS 背景模糊而非巨型 Canvas 位移**。

## 主题统一的选择器

`src/ui/themed-select.js` 会把普通单选 `<select>` 渐进增强为按钮和浮动菜单，保持原 `<select>` 作为唯一状态源。适用于排版字体、交互偏好、编辑器心情等位置。

- 键盘：Enter/Space 展开与确认，方向键移动，Home/End 到首末项，Escape 取消，Tab 关闭。
- 使用 `role=combobox`、`aria-expanded`、`aria-controls`、`aria-activedescendant` 与 `role=listbox/option`。
- 选中时同步原生 `select.value` 并派发 `input`、`change`，**不改现有保存流程**。
- 随浏览器视口自适应显示方向，避开窄屏左右边界。
- 脚本未运行时原生 select 仍存在，不阻止表单逻辑。

## 偏好与兼容性

**继续沿用键 `vigil-appearance-v142`**。新增字段都是可选字段，旧版本偏好读取时由 `normalizeAppearance` 合并默认值；不迁移手记，不更改编辑器本地草稿、JSON 导入格式、GitHub Token 或 git-crypt 密钥处理方式。

新增字段：`sidebarTone`（`accent` / `ink`），`sidebarGlass`（55–96），`sidebarBlur`（0–36），`glassTint`（28–92），`motionMode`（`standard` / `subtle` / `off`）。所有范围和枚举都在 JS 校验，不允许任意字符串混入 CSS。

## 仍需真实设备检查

应在目标 Safari/Firefox 检查 backdrop-filter 与色彩混合支持；对高对比模式和 macOS「减少透明度」偏好做人工检查。图库背景与真实私人 GitHub 仓库需要用户自己的素材/授权后再次验收。代码未修改真实仓库连接或加密逻辑，也未宣称完成旧 v2.8.2 密文迁移。

# VIGIL 1.5 · 液态玻璃与墨绿文房的材料规范

## 来源与实施原则

本版依据用户提供的「液态玻璃 — 风格参考」实现，不把所有内容半透明化。
保留旧纸、朱砂印、深海墨绿、打字机和印刷色彩作为产品识别；让玻璃出现在**真正悬浮的导航、快速检索、主题控制和临时菜单**。
长文、公式、手记卡片、复杂设置、GitHub 编辑器继续使用稳定的近实色正文纸面。

## 色板

| 名称 | Token | 值 |
| --- | --- | --- |
| Paper | `--color-paper` | `#F3F2ED` |
| Graphite ink | `--color-ink` | `#202929` |
| Deep sea scene | `--color-glass-scene` | `#25414A` |
| Salt mist | `--color-glass-mist` | `#E4EFEB` |
| Glancing light | `--color-glass-glint` | `#FFFFFF` |
| Sage focus | `--color-focus` | `#557B79` |
| Heritage seal | `--appearance-accent` | 用户自定义，默认朱砂 |

## 不只是 blur：折射机制

- `index.html` 中定义 `#vigil-glass-bend` SVG 滤镜，使用 `feImage` + `feDisplacementMap`。
- `assets/liquid-displacement.png` 是 768×192 的曲面法线位移图：R/G 对应水平与垂直位移，中心为中性 128/128，只有曲面边带偏移。
- `src/glass/liquid-glass.js` 默认挂载 SVG 滤镜 `url(#vigil-glass-bend)`。为应对不同浏览器在 HTML 背景合成上对 SVG backdrop 的差异，还提供独立的**场景采样 Canvas**。
- Canvas 取与页面同位置的 3200px 水墨背景，按照圆角矩形有符号距离场在内侧约 8–24px 范围产生折射；中心像素不做位移。实际像素差异已在 Chromium 内以滤镜场景开启/关闭进行验证。
- 受限于 SVG backdrop 和不同浏览器的混合模式差异，折射效果不会完全像原生 macOS 控件。无法加载背景或没有 Canvas 时回退到轻透明磨砂底片、高光和清楚边框，不能把这种回退称为完整光学效果。
- 用户上传自定义背景时，玻璃取当前背景的 Blob URL 作为采样来源；文件仍在 IndexedDB，不会自动上传。

## 克制动效和可访问性

- 主胶囊导航高度 64px，内部按钮 49–50px；主题/搜索控件至少 44px。
- 指针按下压缩为 0.96，采用约 110ms 的短促反馈，释放后经 420ms 左右的缓和曲线回原位。
- 键盘 `:focus-visible` 使用独立 2px Sage Focus 焦点环；所有控制保留原生 button，图标具备标题/可访问名称。
- `prefers-reduced-motion` 停用连续呼吸、场景光学动效、回弹；`prefers-reduced-transparency` 隐藏玻璃影像层，切换到不透明着色材质。
- 高对比下界面用明暗背景各自的实色标题、蒙层与边框保证识别；长文始终使用稳定纸面。
- 不使用霓虹、彩虹边、随机圆角、高亮大面积玻璃卡或长文折射。

## 壁纸素材

- `assets/landscape-ink-hd.webp`：3200×1801，来自本项目专门创作的水墨风物底图，经高质量重采样优化为屏幕壁纸（不声称原生 4K 摄影采样）。
- `assets/landscape-ink-deep.webp`：2560×1441，专用于深海墨绿场景。
- 旧 v1.4 打字机静物、梅枝、竹、山、波纹元素仍在，用户可在外观工坊替换背景与主题色。
- 资源自带于项目，首次打开不需要从外网获取壁纸。

## 预览与适配

大屏保留原侧边栏，首页/线索页额外显示小型漂浮胶囊导航；手机则使用同一玻璃胶囊作为触控优先的主导航，并保留可折叠完整入口。响应式检查覆盖 320、390、810、1024、1440、1672px。

样式文件：`src/styles/glass-150.css`、`src/styles/insights-150.css`。

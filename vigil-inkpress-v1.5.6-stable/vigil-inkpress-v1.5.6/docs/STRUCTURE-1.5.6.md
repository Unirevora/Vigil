# 不眠手记 v1.5.6 · 结构与存储优化

## 目标与实测

历史项目的体积主要来自旧版的 70 多张 QA 截图（约 48 MB），而不是手记源码。新版正式交付包**不再包含历次发布截图**，只保留 v1.5.6 当前版本的 4 张关键预览，以及必要的设计、产品与安全规范文档。

运行时 CSS 从 24 条独立请求变为**一条** `/assets/vigil.css`。源码文件及层叠顺序不变：

- `scripts/style-order.json`：定义全部样式文件的精确层叠顺序；最后一层为 `vigil-156.css`。
- `scripts/build-css.mjs`：纯 Node.js，读取 manifest、校验来源及资源地址、合并成 `assets/vigil.css`。
- `npm run dev` 和 `npm start`：自动先执行 CSS 合并，再启动自带的本地 Web 服务器。
- 修改 CSS 后重新执行 `npm run build:css`（或重启开发服务器）即可更新。
- 保留源文件供后续模块化重构，避免用不安全的正则删减 CSS 声明影响显示。

## 背景资源

- 晴岚、月汐保留原 1672 × 941 像素尺寸，但改用 WebP；仅将对应 PNG 压缩为 WebP，**不降低原有分辨率**。
- 四个预设使用不同文件，保留用户自定义背景的 IndexedDB Blob。
- 图片纹理、玻璃折射及夜间可见度仍由 `src/appearance/settings.js`、`src/main.js` 和 `src/glass/liquid-glass.js` 联动。

## 数据存储兼容性

| 存储项 | 规则 | 是否迁移 |
| --- | --- | --- |
| `vigil-mvp-data-v1` | 正式手记保持原 Schema v1 | 无 |
| `vigil-mvp-drafts-v1` | 自动草稿不变 | 无 |
| `vigil-mvp-backups-v1` | 最多 5 份；若当前内容和最新快照相同，不重复写入 | 无 |
| `vigil-appearance-v142` | 用户主题、背景设置键保持不变 | 无 |
| IndexedDB `vigil-appearance-image-v142` | 用户图片继续存为 Blob，不挤占 localStorage | 无 |

设置 → 数据页会按 UTF-16 估算本应用的 localStorage 占用。仅统计以 `vigil-` 开头的键和值的**长度**，不显示任何内容，也不统计其他网站或 IndexedDB 数据。

### 为什么不改成新的压缩数据库？

原应用的本地正式手记、草稿和快照已由现有存储键稳定管理。未经数据迁移验证直接更改 Schema、引入去重引用库或把用户数据迁到 IndexedDB，会增加无法恢复、回退时读取失败的风险。本轮优先采用**不迁移、不丢数据**的优化：跳过完全重复的快照、分离背景图片、缩小源代码发布包。

## 调试与回归

- `npm test`：Node 端单元与代理策略测试。
- `npm run dev`：Node 自动生成 CSS；访问 `http://127.0.0.1:5173/`。
- `scripts/make-inline-qa.py`：仅为受限执行环境中的浏览器排版回归临时生成内联夹具，**不是产品构建方式**。
- 正式页面仍然是多文件原生 ES Modules 和静态资源。

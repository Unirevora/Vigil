# 不眠手记 / Vigil — 模块化重构版

> 从 `MVP.md` 和原先的可交互原型继续重构而来。**这是可以运行的项目，而不是单 HTML 文件。**

## 当前实现

- 首页：最近手记、文章统计、示例内容
- 手记列表：日期排序、标题与正文即时搜索
- 写作：标题、日期、Markdown 源文、保存/修改、未保存提示
- 阅读：安全的基础 Markdown 渲染、编辑与删除
- 数据：本地 `localStorage` 持久化、JSON 校验/导入/导出、替换前尝试备份
- 兼容：**自动复制**上一版单 HTML 原型的 `vigil-mvp-prototype-v1` 数据到新的 `vigil-mvp-data-v1`，且不会删除旧 Key
- 适配：320px / 390px / 810px / 1440px 响应式
- 测试：核心数据、Markdown、迁移与存储错误处理单元测试

## 运行

需要 **Node.js 18+**；无第三方运行依赖，也不需要安装 npm 包。

```bash
npm run dev
```

浏览器打开 <http://127.0.0.1:5173/>。

也可以使用 Python 3 的 HTTP 服务：

```bash
python3 -m http.server 5173
```

> ⚠️ 不要双击 `index.html` 使用 `file://` 运行。原生 ES Modules 需要 HTTP 服务。

## 测试

```bash
npm test
```

## 文件结构

```text
vigil-rebuild/
├── index.html                  # 只放文档结构与样式/模块入口
├── package.json                # 零依赖的运行与测试脚本
├── scripts/
│   └── dev-server.mjs          # Node 原生 HTTP 开发服务器
├── src/
│   ├── main.js                 # UI 状态、交互调度与生命周期
│   ├── core/
│   │   ├── entries.js          # 创建、排序、搜索、统计
│   │   ├── format.js           # 日期、转义、文本工具
│   │   └── markdown.js         # 白名单式基础 Markdown 渲染
│   ├── storage/
│   │   ├── schema.js           # 数据模型与校验
│   │   ├── repository.js       # localStorage、旧原型迁移、写入保护
│   │   └── transfer.js         # JSON 导入、导出、下载
│   ├── data/demo.js            # 初次启动示例手记
│   ├── ui/
│   │   ├── icons.js            # 内联图标
│   │   ├── feedback.js         # Toast、确认弹层
│   │   └── views/              # 各页面独立渲染模块
│   └── styles/
│       ├── foundation.css      # 设计变量与基础排版
│       ├── layout.css          # 应用框架、顶部栏与侧边导航
│       ├── controls.css        # 按钮
│       ├── pages.css           # 首页、列表、写作、阅读与数据管理
│       └── responsive.css      # 移动端和低动态适配
├── tests/                      # Node 内置 test runner
└── docs/MVP.md                 # 对应的功能规格
```

## 数据与安全边界

- **所有数据保存在当前浏览器本地**。清除浏览器数据、使用隐私模式或更换浏览器都可能丢失手记；请使用“门与数据”导出 JSON 备份。
- 本地存储键：`vigil-mvp-data-v1`，与上一版原型的键不同。
- 如发现新键或旧原型键内容损坏，应用进入只读保护，**不会自动清空或覆盖异常数据**。
- 新版可以读取**上一版单 HTML 原型**的数据；这不等于与完整旧项目 v2.8.2 的数据兼容。
- 完整旧项目的真实字段、schema v2 迁移、加密 JSON 格式以及服务端私密入口，**仅凭 CHANGELOG 无法安全复刻**，尚未实现。
- Markdown 在被渲染成 HTML 前先转义原始文本，并限制链接协议；当前仅支持基础 Markdown 语法，复杂 CommonMark、KaTeX 和图片语法尚未实现。
- 目前为本地 MVP，没有账号系统、服务端同步、端到端加密或多设备同步。

## 后续实施建议

1. 根据旧版源码和真实样本补充 `legacy` 数据迁移器与对应测试。
2. 确认编辑器和数据模型后，再添加草稿自动保存、本地备份管理。
3. 将基础 Markdown 渲染替换为经过安全审计的完整解析器（如未来需要高级语法）。
4. 完成线上部署和不同浏览器下的数据迁移验收，再替换旧站。

## 功能规格

见 [`docs/MVP.md`](docs/MVP.md)。

架构细节见 [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)，原始更新日志见 [`docs/CHANGELOG-original.md`](docs/CHANGELOG-original.md)。

# 不眠手记 / VIGIL
### 近代中式复古铅字手记 · v1.1.0

这是在用户提供的模块化原型上继续整理的前端项目，**不是单 HTML 文件**。视觉以近代印刷所、老式中文文具和打字机为意象：深墨棕、旧宣纸、朱砂印泥、黄铜与灰绿色机械键盘。

## 功能

| 模块 | 已实现 |
| --- | --- |
| 手记 | 新建、编辑、删除、日期、Markdown 基础渲染 |
| 目录 | 日期排序、标题与正文即时搜索 |
| 草稿自动保存 | 输入后约 650ms 本地暂存；隐藏/离开页面前再尝试同步写入；可恢复或舍弃 |
| 本地自动备份 | 每次正式保存生成副本，**最多保留最近 5 份** |
| 备份管理 | 手动备份、查看备份时间与字数、删除副本、确认后恢复 |
| 危险操作保护 | 删除、导入、恢复之前先建立当前手记库的本地安全副本 |
| JSON | 已正式保存的手记导入、导出、格式校验 |
| 本地存储 | LocalStorage schema v1，写入错误提示，数据损坏保护 |
| 兼容原型 | 从上一版**单 HTML 原型**的 LocalStorage Key 安全复制旧手记 |
| 移动适配 | 桌面、平板、320px 手机的全部主要页面 |

草稿与正式手记分开存放。**JSON 导出只包含正式存档手记，不包含尚未发表的草稿或历史备份**。需要长期留存时，请先将草稿正式存档，再导出 JSON。

## 直接运行

要求 Node.js 18 或更新版本。**不依赖 npm 第三方包**：

```bash
npm run dev
```

然后打开 `http://127.0.0.1:5173`。

也可以使用 Python 3：

```bash
python3 -m http.server 5173
```

**请勿双击 `index.html` 使用 `file://`**，项目的 ES Modules 需要在 HTTP 服务下运行。

## 你提供的字体

项目会优先加载你放入的两套 TTF：

- `fonts/titlefont.ttf` — 标题字体，字体信息包含「猫啃网烟波宋-S」
- `fonts/textfont.ttf` — 正文字体，字体信息包含「汇文港黑」

下载包保留字体引用与目录说明，**不会重新附带字体二进制文件**。请将它们从你原本的项目文件夹复制回 `fonts/`，或者对你原先的 ZIP 运行：

```bash
python3 scripts/restore-fonts.py ../vigil-rebuild.zip
```

没有复制字体时，会退回系统宋体和中文字体；网站仍能正常工作。请自行核对使用许可。

## 测试

```bash
npm test
```

测试包括条目 CRUD 核心函数、Markdown 转义、schema/迁移、草稿恢复、备份 5 份上限、存储损坏和空间不足保护。

## 项目结构

```text
vigil-rebuild-v2/
├── index.html
├── package.json
├── assets/paper-grain.svg            # 低对比纸张颗粒
├── fonts/README.md                   # 字体文件的放置说明
├── src/
│   ├── main.js                       # 状态和 UI 交互
│   ├── core/
│   │   ├── entries.js                # 条目 CRUD 模型、排序与统计
│   │   ├── markdown.js               # 基础 Markdown 安全渲染
│   │   └── format.js                 # 日期与字符工具
│   ├── storage/
│   │   ├── schema.js                 # 手记 Schema v1
│   │   ├── repository.js             # 正式手记本地仓库
│   │   ├── transfer.js               # JSON 进出
│   │   ├── drafts.js                 # 独立草稿存储
│   │   └── backups.js                # 五份历史备份管理
│   ├── data/demo.js                  # 演示手记
│   ├── ui/
│   │   ├── views/                    # 每个页面单独模块
│   │   ├── feedback.js               # 自绘确认框与提示
│   │   └── icons.js                  # 小图标
│   └── styles/
│       ├── foundation.css            # 配色、字体、纹理
│       ├── layout.css                # 侧栏、顶栏、版心
│       ├── controls.css              # 复古按键与弹层
│       ├── pages.css                 # 首页、索引、写作、阅读、数据页
│       └── responsive.css            # 响应式布局
├── tests/                            # Node 原生测试
├── scripts/
│   ├── dev-server.mjs
│   └── restore-fonts.py
└── docs/
    ├── MVP.md
    ├── ARCHITECTURE.md
    └── CHANGELOG-original.md
```

## 数据安全说明（重要）

- 此项目属于本地优先 MVP，**不是加密云笔记**。数据仅存在当前浏览器 localStorage。
- 清理浏览器数据、浏览器损坏、更换设备或启用隐私窗口，可能同时清除正式手记、草稿和本地备份。
- 自动备份不是异地备份。请定期导出 JSON 到电脑其他目录或安全存储位置。
- 历史副本恢复操作会替换整个**正式手记库**；恢复前会建立当前数据的快照，**草稿本身不会被覆盖**。
- 单份损坏的草稿/备份存储不会被无声清空；系统会提示并停止写入对应区域。
- JSON 文件只接受新项目 Schema v1。原项目 v2.8.2 的真实数据结构、加密文件和认证入口**未验证**，不得把旧数据直接当作兼容格式覆盖导入。

## 后续规划

建议以实际旧项目的 `js/storage.js`、`js/core/entries.js` 和旧版 JSON 样本为依据，新增单独的旧数据迁移器。再扩展日期归档、草稿版本、跨设备同步等 P1 功能。

详细实现方案见 [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)。

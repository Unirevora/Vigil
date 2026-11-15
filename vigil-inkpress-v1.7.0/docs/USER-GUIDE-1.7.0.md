# 1.7.0 · 双卷合璧 · 操作与设计说明

## A. 设计目标

保留旧纸、墨棕与朱砂的视觉识别度，让**远端 GitHub Markdown 真正成为一等手记**，而不是在技术设置侧栏里做简陋编辑。远端文件不应私自复制到本地正式手记库，也不应在加密路径上绕过 git-crypt 过滤器。

## B. 两种文库的操作

1. 从左侧导航进入「全部手记」，顶部提供「本地手记」和「GitHub 仓库」两项。
2. 未连接时，GitHub 页签展示连接引导；连接成功自动进入此页签。
3. GitHub 页签展示仓库/分支/文件夹，目录按钮支持逐层下钻与返回；只展示 Markdown 文件，提供当前目录内文件名检索。
4. 选择文件进入与本地手记同一 `.reading-paper` 布局；可以切换到完整 `.editor-paper`，支持实时/阅读/源码、KaTeX、工具栏、大纲与查找替换。
5. 新建远端 Markdown 时先填写仓库内路径（`.md` 或 `.markdown`），然后在完整编辑器内完成正文。文件路径仍需位于用户选定的笔记目录内。
6. 页面编辑过程中写入本机草稿，不写入正式本地条目。只有点击「提交 GitHub」才发出 HTTPS PUT。

### GitHub 安全约束

- 公开仓库匿名可浏览，但写入需要 Token。精细令牌至少授予目标仓库 Contents: Read and write。
- 提交请求带原 `sha`，冲突不能静默覆盖；写入不做不确定的网络重试。
- 每次保存前重新检查仓库 `.gitattributes` 加密规则；命中 `git-crypt` 时，必须持有匹配的本机密钥并加密提交；属性规则未知或有风险时拒绝猜测性明文写入。
- 远端文库草稿使用 `github:<hash>` 键独立保存；hash 依据仓库/分支/文件路径生成，不含令牌。本地正式手记 Schema 保持不变。
- 断开仓库后令牌仍只存在应用运行内存中；刷新、重新启动都需要重新授权。git-crypt key 也不持久化。
- 不自动镜像 GitHub 文件到本地文库，也不支持远端文件重命名 / 大量批量同步。

## C. Obsidian 语法补充

支持六级标题与其对应的阅读、实时文本大小。引用块从连续 `>` 行渲染，在其中使用 `> [!type] 可选标题` 可渲染 Callout。`[!type]+` 默认展开可折叠，`[!type]-` 默认折叠。嵌套引用写为 `> >`。

```markdown
#### 层级四
> 引用段落
>
> 第二段

> [!note] 一般提示
> 内容

> [!tip]+ 可收起
> 内容

> [!question]- 默认折叠
> 可以嵌套其他 Callout
> > [!note] 内层提示
> > 内容

<span class="font-kai" style="font-family: KaiTi; font-size: 20px">手札文字</span>
<div class="font-song" style="text-align:center">标题排版</div>
```

**安全边界：** 只支持 HTML 标签和 CSS 属性的白名单，不运行任意外部 CSS 片段，也不执行脚本、iframe、`url(...)`、`on*` 事件。手动指定 `font-kai` / `font-song` / `font-sans` / `font-typed` / `font-accent` 有内置主题别名；其他合法类名会保留，但必须在项目 CSS 中自行声明才能产生效果。内容渲染不是 Obsidian 完全兼容性承诺。

## D. 品牌与布局

保留朱砂印章、中文标题和小字号品牌副标题；删除顶部装饰英文编号。桌面侧栏底部左对齐显示 `v1.7.0`，不再显示「仅此设备」或 Edition 编号。手机端保持原折叠菜单和易触摸导航。

## E. 关联文件

- `src/github/notebook.js`：远端文库标题/草稿隔离/路径范围校验。
- `src/ui/views/entries.js`：双文库选项卡、目录与搜索。
- `src/ui/views/reader.js`、`src/ui/views/editor.js`：统一读写工作台。
- `src/main.js`：远端状态、草稿、SHA 安全提交。
- `src/core/markdown.js`、`src/core/safe-html.js`、`src/editor/live-markdown.js`：阅读与实时语法。
- `src/styles/vigil-170.css`：视觉一致性、六级标题、引用/Callout 与移动端样式。

## F. 测试边界

本版浏览器自动化使用模拟 GitHub API 数据，验证完整页面交互，不调用真实私人仓库；真实网络、Token、组织 SSO 和 git-crypt 互操作需用户在自己的仓库验证。保留现有加密格式、存储键、侧栏主题等功能。涉及用户数据，请在升级前导出一份本地 JSON 或加密备份。

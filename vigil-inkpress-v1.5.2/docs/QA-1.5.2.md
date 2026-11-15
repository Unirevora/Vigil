# VIGIL Inkpress 1.5.2 · QA 记录

## 核验项目

- `npm test`：81 项 Node 测试全部通过（保留历史回归，新增格式工具、右侧大纲、设置选项卡和响应式 CSS 验证）。
- `python3 scripts/qa-152.py`：33 项 Chromium 界面断言全部通过，包括：桌面底部导航隐藏、设置外观/数据切换、Markdown 标题和编号列表格式化、大纲展开与收起、阅读模式切换、320/390/768/1440px 页面无横向溢出、移动端遮罩关闭大纲、各宽度未出现运行时 JS 错误。
- 目视核验：桌面首页、编辑器/阅读模式、大纲、设置（外观及数据）和 390px 手机编辑器、数据设置和大纲截图。
- `node --check` 检查所有源 JS 的语法；`package.json` / `index.html` / README 标识均改为 1.5.2。

## 重现方式

```bash
npm test
python3 scripts/qa-152.py  # 需要本地安装 Playwright Python + Chromium
```

浏览器自动化使用 `make-inline-qa.py` 将真实多文件 ESM 模块组合为**一次性的离线验证夹具**，因为测试环境的 Chromium 禁止导航到 localhost；交付版本仍是正常的独立 ES Modules 网站，未把应用改为内联单 HTML。

## 截图

- `preview-152-home-desktop.png`
- `preview-152-settings-appearance.png` / `preview-152-settings-data.png`
- `preview-152-editor-outline-desktop.png` / `preview-152-editor-reading.png`
- `preview-152-editor-mobile.png` / `preview-152-outline-mobile.png` / `preview-152-settings-mobile.png`

## 边界

- 未访问任何真实用户 GitHub / Google / 加密备份账户或文件。原有 GitHub、git-crypt、JSON 加密逻辑未更改，本地既有回归测试仍保留。
- 建议发布后用目标设备补测：中文输入法组合输入、Safari/Firefox 下 MathML、复杂 Markdown 嵌套、极长手记性能、真实图片导入与存储限额。

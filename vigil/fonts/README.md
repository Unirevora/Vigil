# 字体引用与本地整包方案

本项目保留了你之前提供的两套字体的引用：

- `titlefont.ttf` → `VigilTitle`，用于页面标题、节气名、诗笺、按钮中的装饰标题。
- `textfont.ttf` → `VigilText`，用于普通界面与正文。

项目 CSS：`src/styles/foundation.css` 中的 `@font-face`。若字体尚未复制，界面自动回退到系统中文字体，不影响功能。

## 在你自己的电脑上一键恢复

从你最初的 `vigil-rebuild.zip` 中还原两套字体：

```bash
python3 scripts/restore-fonts.py /path/to/vigil-rebuild.zip
```

如果希望再生成一个**包含这两套字体的完整 ZIP 包**，无需手动复制：

```bash
python3 scripts/pack-with-local-fonts.py /path/to/vigil-rebuild.zip
```

会在项目同级目录生成 `vigil-inkpress-with-local-fonts.zip`。所有字体只从你自己持有的原始包中读取，不进行互联网下载，也不会改写源文件。

本交付源码包中不直接包含字体二进制文件；使用字体之前请确认相应的许可条款。

# 字体放置说明

请保留你原项目压缩包中已经提供的两套字体，并放在这个目录：

- `textfont.ttf` — 汇文港黑（正文 / UI）
- `titlefont.ttf` — 猫啃网烟波宋-S（大标题 / 印刷刊头）

样式在 `src/styles/foundation.css` 的 `@font-face` 中引用这些原文件。

可直接从原始项目的 `fonts` 目录复制，或执行项目根目录下的：

```bash
python3 scripts/restore-fonts.py /path/to/your/original-vigil-rebuild.zip
```

字体文件没有随此次发布包重复分发；没有复制时会自动使用系统宋体和中文字体兜底，功能不受影响。
请自行确认字体的许可使用范围，特别是线上公开部署时。

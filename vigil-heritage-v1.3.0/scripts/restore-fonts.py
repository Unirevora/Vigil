#!/usr/bin/env python3
"""Extract only the user's own fonts from their original Vigil ZIP.

Usage: python3 scripts/restore-fonts.py /path/to/original-vigil-rebuild.zip
No downloads; never replaces an existing font without permission.
"""
import sys
from pathlib import Path
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parent.parent
REQUIRED = ("textfont.ttf", "titlefont.ttf")

def main():
    if len(sys.argv) != 2:
        print("用法: python3 scripts/restore-fonts.py /path/to/original-vigil-rebuild.zip")
        return 2
    archive = Path(sys.argv[1]).expanduser().resolve()
    if not archive.is_file():
        print(f"找不到压缩包：{archive}")
        return 1
    dest = ROOT / "fonts"
    dest.mkdir(parents=True, exist_ok=True)
    with ZipFile(archive) as z:
        names = set(z.namelist())
        for name in REQUIRED:
            source = f"vigil-rebuild/fonts/{name}"
            if source not in names:
                print(f"原项目缺少：{source}")
                return 1
        for name in REQUIRED:
            target = dest / name
            if target.exists():
                print(f"保留已有字体：{target.name}")
                continue
            source = f"vigil-rebuild/fonts/{name}"
            # Explicit fixed-name extraction prevents ZIP path traversal.
            target.write_bytes(z.read(source))
            print(f"已从你提供的原始项目恢复：{name}")
    print("字体恢复完成。")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
"""Locally package this project plus the user's OWN font files.

Usage:
  python3 scripts/pack-with-local-fonts.py /path/to/vigil-rebuild.zip
  python3 scripts/pack-with-local-fonts.py /path/to/original.zip /path/to/output.zip

The distributed source archive contains no font binaries. This helper copies
only titlefont.ttf and textfont.ttf from a user-owned ZIP *on their computer*
into a private combined distribution. It never downloads fonts.
"""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import sys

ROOT=Path(__file__).resolve().parent.parent
REQUIRED={'titlefont.ttf':'vigil-rebuild/fonts/titlefont.ttf',
          'textfont.ttf':'vigil-rebuild/fonts/textfont.ttf'}
FOLDER='vigil-inkpress'

def main():
    if len(sys.argv)<2:
        print('用法：python3 scripts/pack-with-local-fonts.py /path/to/vigil-rebuild.zip [output.zip]')
        return 2
    src=Path(sys.argv[1]).expanduser().resolve()
    out=Path(sys.argv[2]).expanduser().resolve() if len(sys.argv)>=3 else ROOT.parent/'vigil-inkpress-with-local-fonts.zip'
    if not src.is_file():
        print(f'找不到用户原始包：{src}')
        return 1
    if out==src:
        print('输出文件不能覆盖原始字体包。')
        return 1
    with ZipFile(src) as original:
        found=set(original.namelist())
        for filename,arcname in REQUIRED.items():
            if arcname not in found:
                print(f'原始包中缺少：{arcname}')
                return 1
        out.parent.mkdir(parents=True,exist_ok=True)
        with ZipFile(out,'w',compression=ZIP_DEFLATED,compresslevel=6) as package:
            for file in sorted(ROOT.rglob('*')):
                if not file.is_file() or '__pycache__' in file.parts:
                    continue
                if file.suffix.lower() in ('.ttf','.otf','.woff','.woff2'):
                    continue
                package.write(file,f'{FOLDER}/{file.relative_to(ROOT)}')
            for filename,arcname in REQUIRED.items():
                package.writestr(f'{FOLDER}/fonts/{filename}',original.read(arcname))
                print(f'已打包用户原始字体：{filename}')
    print(f'本地完整打包成功：{out}')
    print('此结果仅由用户在自己设备上生成，请自行遵守字体许可。')
    return 0

if __name__=='__main__':
    raise SystemExit(main())

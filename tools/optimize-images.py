#!/usr/bin/env python3
"""Premodel asset optimizer — re-runnable, never touches the masters.

images/ stays the working directory for full-res renders (keep dropping new
files in exactly as today). This script mirrors it into images-opt/ with
web-ready derivatives, skipping anything already up to date, and writes a
manifest mapping original → optimized path so the HTML references can be
flipped mechanically at launch.

Rules
  - photos/renders (.png .jpg .jpeg, opaque) → resized to ≤1600px wide,
    re-encoded as quality-82 JPEG (renders don't need lossless)
  - PNGs with transparency (logos, UI) → resized PNG, format kept
  - .mp4 / .gif → copied through untouched (re-encode is a launch task;
    flagged in the report so nothing slips silently)
  - already-processed files (output newer than input) → skipped

Usage
  python3 tools/optimize-images.py            # process + report
  python3 tools/optimize-images.py --dry-run  # report only, write nothing

Requires Pillow (available on this machine's system python3).
"""
import os
import sys
import json

from PIL import Image

SRC = 'images'
DST = 'images-opt'
MAX_W = 1600          # ≈2× the largest display width (840px hero card)
JPEG_Q = 82
MANIFEST = os.path.join(DST, 'manifest.json')

dry = '--dry-run' in sys.argv


def has_alpha(im):
    return im.mode in ('RGBA', 'LA', 'P') and (
        im.mode != 'P' or 'transparency' in im.info
    ) and im.convert('RGBA').getextrema()[3][0] < 255


def main():
    if not os.path.isdir(SRC):
        sys.exit(f'run from the repo root ({SRC}/ not found)')
    os.makedirs(DST, exist_ok=True)

    manifest = {}
    in_total = out_total = 0
    skipped = passthrough = processed = 0

    for name in sorted(os.listdir(SRC)):
        src = os.path.join(SRC, name)
        if not os.path.isfile(src):
            continue
        base, ext = os.path.splitext(name)
        ext = ext.lower()
        in_size = os.path.getsize(src)
        in_total += in_size

        if ext in ('.mp4', '.gif'):
            dst = os.path.join(DST, name)
            manifest[src] = dst
            passthrough += 1
            if not dry and (not os.path.exists(dst) or os.path.getmtime(dst) < os.path.getmtime(src)):
                import shutil
                shutil.copy2(src, dst)
            out_total += os.path.getsize(dst) if os.path.exists(dst) else in_size
            continue

        if ext not in ('.png', '.jpg', '.jpeg'):
            continue

        im = Image.open(src)
        alpha = ext == '.png' and has_alpha(im)
        out_name = name if alpha else base + '.jpg'
        dst = os.path.join(DST, out_name)
        manifest[src] = dst

        if os.path.exists(dst) and os.path.getmtime(dst) >= os.path.getmtime(src):
            skipped += 1
            out_total += os.path.getsize(dst)
            continue

        if im.width > MAX_W:
            im = im.resize((MAX_W, round(im.height * MAX_W / im.width)), Image.LANCZOS)
        if not dry:
            if alpha:
                im.save(dst, optimize=True)
            else:
                im.convert('RGB').save(dst, quality=JPEG_Q, optimize=True, progressive=True)
            out_total += os.path.getsize(dst)
        processed += 1

    if not dry:
        with open(MANIFEST, 'w') as f:
            json.dump(manifest, f, indent=2, sort_keys=True)

    print(f'masters:    {in_total / 1048576:8.1f} MB')
    if not dry:
        print(f'optimized:  {out_total / 1048576:8.1f} MB  ({(1 - out_total / max(in_total, 1)) * 100:.0f}% smaller)')
    print(f'processed:  {processed}   up-to-date: {skipped}   copied through (video/gif — re-encode before launch): {passthrough}')
    print(f'manifest:   {MANIFEST}')
    print('\nLaunch flip: point HTML references at images-opt/ using the manifest')
    print('(extensions change for converted PNGs — the manifest carries the mapping).')


if __name__ == '__main__':
    main()

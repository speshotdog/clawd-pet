# -*- coding: utf-8 -*-
"""觀星系列的動態卡（2026-09-13 之後這一輪）。

REPORT-5.0-cards.md 的待辦：「觀星日後升級動態」。這裡走**不摳圖**那條路
（使用者 2026-09-13 定案：摳不出來就不要摳）——整幅畫的 5:7 視窗直接動起來，
不做逐幀主體／alpha，所以沒有去背品質的風險，只是靜卡換成會動的同一個視窗。

視窗＝`prepare_5_0_flat.py` 的 CARDS 那一份（同一個臉中心、同一個高度），
所以動態卡跟現有靜卡是同一個構圖，只是多了時間。

來源：source-5.0/觀星系列 拆四張卡.mp4（1080×1920、60fps、29.5s）。
靜卡取的是第 120 格（2.000 秒），動態版以它為中心取一段，來回播（ping-pong）避免接點跳。

用法：python build_star_motion.py [--seconds 3] [--fps 24] [--quality 72]
輸出：art/card-<id>-motion.webp（動畫 WebP，可直接放進 <img>）
"""
import argparse, subprocess, sys, tempfile
from pathlib import Path
from PIL import Image
from prepare_5_0_flat import CARDS, STAR, window

HERE = Path(__file__).resolve().parent
OUT = HERE / 'art'
FFMPEG = 'ffmpeg'
CENTER = 2.0   # 靜卡用的那一格（第 120 格 @60fps）


def frames(seconds, fps, tmp):
    start = max(0, CENTER - seconds / 2)
    subprocess.run([FFMPEG, '-v', 'error', '-y', '-ss', f'{start:.3f}', '-t', f'{seconds:.3f}',
                    '-i', str(STAR.parent / '觀星系列 拆四張卡.mp4'),
                    '-vf', f'fps={fps}', str(tmp / 'f%04d.png')], check=True)
    return sorted(tmp.glob('f*.png'))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--seconds', type=float, default=3.0)
    ap.add_argument('--fps', type=int, default=24)
    ap.add_argument('--quality', type=int, default=72)
    a = ap.parse_args()
    ids = [i for i, (src, *_ ) in CARDS.items() if src == STAR]
    with tempfile.TemporaryDirectory() as td:
        tmp = Path(td)
        fs = frames(a.seconds, a.fps, tmp)
        print(f'抽出 {len(fs)} 格（{a.seconds}s @ {a.fps}fps，以第 120 格為中心）')
        for ident in ids:
            src, face, ch = CARDS[ident]
            with Image.open(fs[0]) as probe: size = probe.size
            win = window(size, face, ch)
            seq = []
            for f in fs:
                with Image.open(f) as im:
                    seq.append(im.convert('RGB').crop(win).resize((600, 840), Image.LANCZOS))
            loop = seq + seq[-2:0:-1]   # ping-pong：來回播，接點不跳
            dest = OUT / f'card-{ident}-motion.webp'
            loop[0].save(dest, 'WEBP', save_all=True, append_images=loop[1:],
                         duration=round(1000 / a.fps), loop=0, quality=a.quality, method=4)
            print(f'{ident:20s} window {win}  {len(loop)} 格  {dest.stat().st_size/1e6:.2f} MB  → {dest.name}')


if __name__ == '__main__':
    sys.exit(main())

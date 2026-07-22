#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Apply the approved ART-FIX pixel repairs using only the two reference PNGs.

The script is deliberately idempotent: every run copies the approved source
pixels again and regenerates the four eye sprites plus their body cut-outs.
Run it from the repository root:

    python -B tools/vtest/fix_art_assets.py
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image


ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "src"


def rgba(path: Path) -> Image.Image:
    return Image.open(path).convert("RGBA")


def copy_reference_regions(character: str, target: str, regions: list[tuple[int, int, int, int]]) -> None:
    """Copy approved rectangular source pixels exactly, including alpha."""
    reference = rgba(ROOT / f"ref-{character}.png")
    destination = rgba(SRC / target)
    for x0, y0, x1, y1 in regions:
        destination.paste(reference.crop((x0, y0, x1, y1)), (x0, y0))
    destination.save(SRC / target)


def _source_pixel(background: np.ndarray, target: np.ndarray, ink: np.ndarray) -> tuple[np.ndarray, int]:
    """Encode one reference pixel as an alpha-blended ink pixel over background.

    For each edge pixel this finds an alpha close to the reference's apparent
    coverage and RGB values which round-trip exactly through Pillow's
    source-over blend.  Full-coverage interior pixels remain their original
    ink colour.  This retains antialiasing when the tight sprite is scaled.
    """
    if np.array_equal(target, background):
        return np.zeros(3, dtype=np.uint8), 0

    # Estimate coverage from the channel gradients, then favour it while
    # choosing a value that is exactly representable by alpha compositing.
    delta = background.astype(float) - ink.astype(float)
    valid = np.abs(delta) > 0.5
    estimate = np.mean((background[valid] - target[valid]) * 255.0 / delta[valid])
    estimate = float(np.clip(estimate, 1, 255))

    best: tuple[float, np.ndarray, int] | None = None
    for alpha in range(1, 256):
        values = []
        for bg, wanted, preferred in zip(background, target, ink):
            # floor((value * alpha + base + 127) / 255) == wanted
            # gives this closed integer interval without trialling 256 values.
            base = int(bg) * (255 - alpha)
            low = (int(wanted) * 255 - base - 127 + alpha - 1) // alpha
            high = ((int(wanted) + 1) * 255 - base - 127 - 1) // alpha
            low, high = max(0, low), min(255, high)
            if low > high:
                break
            values.append(min(max(int(preferred), low), high))
        else:
            rgb = np.asarray(values, dtype=np.uint8)
            # Coverage is the important part for edge behaviour; source RGB
            # only resolves quantisation ties.
            score = abs(alpha - estimate) * 1000 + int(np.abs(rgb.astype(int) - ink.astype(int)).sum())
            if best is None or score < best[0]:
                best = (score, rgb, alpha)

    if best is None:  # Defensive only; alpha=255 is always representable.
        return target.astype(np.uint8), 255
    return best[1], best[2]


def build_eye(character: str, side: str, bbox: tuple[int, int, int, int], background_rgb: tuple[int, int, int], ink_rgb: tuple[int, int, int]) -> None:
    """Extract one tight original eye and replace its body area with base colour."""
    x0, y0, x1, y1 = bbox
    reference = rgba(ROOT / f"ref-{character}.png")
    body_path = SRC / f"{character}-body.png"
    body = rgba(body_path)
    ref = np.asarray(reference, dtype=np.uint8)
    bg = np.asarray(background_rgb, dtype=np.uint8)
    ink = np.asarray(ink_rgb, dtype=np.uint8)

    crop = ref[y0:y1, x0:x1, :3]
    sprite = np.zeros((y1 - y0, x1 - x0, 4), dtype=np.uint8)
    for y in range(sprite.shape[0]):
        for x in range(sprite.shape[1]):
            rgb, alpha = _source_pixel(bg, crop[y, x], ink)
            sprite[y, x, :3] = rgb
            sprite[y, x, 3] = alpha

    # The reference face base is flat in these tight regions.  Bake that exact
    # surrounding base into body rather than covering it with an SVG ellipse.
    body_arr = np.asarray(body).copy()
    body_arr[y0:y1, x0:x1, :3] = bg
    body_arr[y0:y1, x0:x1, 3] = 255
    Image.fromarray(body_arr, "RGBA").save(body_path)
    Image.fromarray(sprite, "RGBA").save(SRC / f"{character}-eye{side}.png")

    # Exact zero-degree reconstruction check for this eye/background pair.
    rebuilt = Image.new("RGBA", reference.size, (0, 0, 0, 0))
    rebuilt.alpha_composite(Image.fromarray(body_arr, "RGBA"))
    rebuilt.alpha_composite(Image.fromarray(sprite, "RGBA"), (x0, y0))
    actual = np.asarray(rebuilt)[y0:y1, x0:x1]
    expected = ref[y0:y1, x0:x1]
    if not np.array_equal(actual, expected):
        delta = int(np.abs(actual.astype(int) - expected.astype(int)).max())
        raise RuntimeError(f"{character} eye{side} did not reconstruct exactly (max channel delta {delta})")


def main() -> None:
    # FIX-1: the front knife-arm owns both missing original strokes.
    copy_reference_regions("jiaobu", "jiaobu-pawR.png", [
        (388, 406, 402, 413),
        (475, 537, 478, 540),
    ])
    # FIX-2: the approved two-pixel tail-root repair plus its immediately
    # adjacent source pair.  PIL's +1 degree preflight otherwise exposes the
    # latter pair at x=612 even though the documented x=611 pair is filled.
    # Both are original reference pixels baked into the static body layer.
    copy_reference_regions("yueyue", "yueyue-body.png", [(611, 333, 613, 335)])

    # FIX-3: tight original eye sprites.  The coordinates are source-pixel
    # bboxes; their base colours and interior inks are sampled from the refs.
    build_eye("jiaobu", "L", (294, 303, 322, 345), (206, 178, 120), (56, 48, 46))
    build_eye("jiaobu", "R", (390, 299, 419, 341), (206, 178, 120), (54, 47, 45))
    build_eye("yueyue", "L", (334, 206, 360, 247), (162, 159, 151), (53, 46, 46))
    build_eye("yueyue", "R", (391, 216, 417, 254), (162, 159, 151), (53, 46, 46))
    print("Applied FIX-1, FIX-2, and FIX-3 from reference pixels.")


if __name__ == "__main__":
    main()

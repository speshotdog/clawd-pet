#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Read-only asset diagnosis for jiaobu and yueyue.

This intentionally models only the PNG-layer side of the SVG templates.  It
does *not* claim to reproduce Chromium AA; use tools/vtest/vtest.html plus
metrics.py for release acceptance.  It is useful for repeatable triage:

* reconstruct the zero-degree PNG stack and compare it with the reference;
* repeat that comparison after a 198 CSS px x DPR 1.875 downscale;
* rotate every movable PNG layer at the actual configured endpoint angles and
  report newly exposed background pixels and changed dark-on-light regions.

It writes no analysis files.  Run from the repository root with ``-B`` so
Python also does not create a bytecode cache:
    python -B tools/vtest/diag_art_assets.py
    python -B tools/vtest/diag_art_assets.py --character jiaobu
"""
from __future__ import annotations

import argparse
import json
from collections import deque
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "src"
DPR = 1.875
DISPLAY_HEIGHT_CSS = 198


@dataclass(frozen=True)
class Character:
    name: str
    reference: str
    viewbox: tuple[int, int, int, int]
    # Back to front; (file stem, optional SVG clip rectangle x/y/w/h/rx).
    layers: tuple[tuple[str, tuple[int, int, int, int, int] | None], ...]
    pivots: dict[str, tuple[int, int]]
    endpoint_degrees: dict[str, tuple[float, ...]]
    # Tight original eye sprites composited above body at zero degrees.
    eyes: tuple[tuple[str, int, int], ...]


CHARACTERS = {
    "jiaobu": Character(
        "jiaobu", "ref-jiaobu.png", (121, 63, 553, 635),
        (("tail", None), ("legL", (160, 621, 148, 97, 14)),
         ("legR", (470, 621, 148, 97, 14)), ("body", None), ("pawR", None)),
        {"tail": (604, 560), "legL": (234, 650), "legR": (544, 650), "pawR": (533, 452)},
        # limbScale=.5, pawScale=.5; actual animate() extrema by state.
        {"tail": (-5.0, 5.0), "legL": (-6.5, 6.5), "legR": (-6.5, 6.5),
         "pawR": (-2.75, 2.75, -5.5, 5.5, 5.75, 7.25)},
        (("jiaobu-eyeL.png", 294, 303), ("jiaobu-eyeR.png", 390, 299)),
    ),
    "yueyue": Character(
        "yueyue", "ref-yueyue.png", (40, 21, 688, 726),
        (("tail", None), ("legL", (42, 658, 221, 108, 14)),
         ("legR", (447, 658, 176, 108, 14)), ("pawR", (30, 392, 130, 162, 12)),
         ("body", None)),
        {"tail": (608, 385), "legL": (150, 690), "legR": (535, 692), "pawR": (145, 515)},
        # limbScale=.5; tailScale=.2.  Paw ask/hi is included although it is
        # drawn below body, because an exposed clip corner would still matter.
        {"tail": (-1.0, 1.0), "legL": (-6.5, 6.5), "legR": (-6.5, 6.5),
         "pawR": (-5.5, 5.5, -11.0, 11.0, 11.5, 14.5)},
        (("yueyue-eyeL.png", 334, 206), ("yueyue-eyeR.png", 391, 216)),
    ),
}


def rgba(path: Path) -> Image.Image:
    return Image.open(path).convert("RGBA")


def rounded_clip(size: tuple[int, int], clip: tuple[int, int, int, int, int] | None) -> Image.Image | None:
    if clip is None:
        return None
    x, y, w, h, radius = clip
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((x, y, x + w, y + h), radius=radius, fill=255)
    return mask


def load_layer(c: Character, part: str, clip) -> Image.Image:
    im = rgba(SRC / f"{c.name}-{part}.png")
    mask = rounded_clip(im.size, clip)
    if mask is not None:
        alpha = Image.composite(im.getchannel("A"), Image.new("L", im.size, 0), mask)
        im.putalpha(alpha)
    return im


def rotate_full_canvas(im: Image.Image, deg: float, pivot: tuple[int, int]) -> Image.Image:
    # SVG positive angles are clockwise in its y-down coordinate system; PIL
    # uses counter-clockwise mathematical angles, hence the sign reversal.
    return im.rotate(-deg, resample=Image.Resampling.BICUBIC, center=pivot)


def stack(c: Character, transformed: tuple[str, float] | None = None) -> tuple[Image.Image, list[np.ndarray]]:
    canvas = Image.new("RGBA", (768, 768), (0, 0, 0, 0))
    alpha_layers = []
    for part, clip in c.layers:
        im = load_layer(c, part, clip)
        if transformed and part == transformed[0]:
            im = rotate_full_canvas(im, transformed[1], c.pivots[part])
        alpha_layers.append(np.asarray(im.getchannel("A"), dtype=np.uint8))
        canvas.alpha_composite(im)
    for filename, x, y in c.eyes:
        eye = rgba(SRC / filename)
        eye_layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
        eye_layer.alpha_composite(eye, (x, y))
        alpha_layers.append(np.asarray(eye_layer.getchannel("A"), dtype=np.uint8))
        canvas.alpha_composite(eye_layer)
    return canvas, alpha_layers


def lum(a: np.ndarray) -> np.ndarray:
    return .299 * a[..., 0] + .587 * a[..., 1] + .114 * a[..., 2]


def ref_alpha(ref: np.ndarray) -> np.ndarray:
    # References may be opaque white-background PNGs.  Treat connected near-
    # white edge background as transparent for silhouette-only tests.
    alpha = ref[..., 3].copy()
    white = (ref[..., :3] > 245).all(axis=2)
    edge = np.zeros_like(white, bool)
    edge[0] = edge[-1] = True; edge[:, 0] = edge[:, -1] = True
    seen = np.zeros_like(white, bool)
    q = deque(map(tuple, np.argwhere(edge & white)))
    while q:
        y, x = q.popleft()
        if seen[y, x] or not white[y, x]:
            continue
        seen[y, x] = True
        for yy, xx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if 0 <= yy < white.shape[0] and 0 <= xx < white.shape[1] and not seen[yy, xx]:
                q.append((yy, xx))
    alpha[seen] = 0
    return alpha


def components(mask: np.ndarray, minimum: int = 1) -> list[dict]:
    """4-connected component summaries, dependency-free and deterministic."""
    h, w = mask.shape
    todo = mask.copy()
    ans = []
    for y, x in zip(*np.where(todo)):
        if not todo[y, x]:
            continue
        q = [(y, x)]; todo[y, x] = False; pts = []
        while q:
            yy, xx = q.pop(); pts.append((yy, xx))
            for ny, nx in ((yy - 1, xx), (yy + 1, xx), (yy, xx - 1), (yy, xx + 1)):
                if 0 <= ny < h and 0 <= nx < w and todo[ny, nx]:
                    todo[ny, nx] = False; q.append((ny, nx))
        if len(pts) >= minimum:
            ys, xs = zip(*pts)
            ans.append({"px": len(pts), "bbox": [int(min(xs)), int(min(ys)),
                        int(max(xs) - min(xs) + 1), int(max(ys) - min(ys) + 1)]})
    return sorted(ans, key=lambda x: x["px"], reverse=True)


def enclosed_transparent(alpha: np.ndarray) -> np.ndarray:
    """Transparent pixels enclosed on all four cardinal directions by ink.

    This mirrors the geometry of vtest/metrics.py's gap detector, but remains
    a PIL-only preflight rather than a Chromium verdict.
    """
    on, off = alpha > 128, alpha < 64
    h, w = on.shape
    left = np.zeros_like(on); right = np.zeros_like(on)
    up = np.zeros_like(on); down = np.zeros_like(on)
    seen = np.zeros(h, dtype=bool)
    for x in range(w):
        seen |= on[:, x]; left[:, x] = seen
    seen = np.zeros(h, dtype=bool)
    for x in range(w - 1, -1, -1):
        seen |= on[:, x]; right[:, x] = seen
    seen = np.zeros(w, dtype=bool)
    for y in range(h):
        seen |= on[y]; up[y] = seen
    seen = np.zeros(w, dtype=bool)
    for y in range(h - 1, -1, -1):
        seen |= on[y]; down[y] = seen
    return off & left & right & up & down


def static_report(c: Character) -> dict:
    comp, alphas = stack(c)
    a = np.asarray(comp)
    ref = np.asarray(rgba(ROOT / c.reference))
    # FIX-3 uses original tight eye sprites, so every visible pixel is now
    # part of the zero-degree reconstruction comparison.
    mask = (a[..., 3] > 0) | (ref_alpha(ref) > 0)
    rgb_delta = np.max(np.abs(a[..., :3].astype(np.int16) - ref[..., :3].astype(np.int16)), axis=2)
    alpha_delta = np.abs(a[..., 3].astype(np.int16) - ref_alpha(ref).astype(np.int16))
    # Count AA overlap candidates: two source layers with nontrivial alpha at
    # the same pixel.  Those are exactly where Chromium can darken on resize.
    nonopaque_overlap = np.zeros((768, 768), np.uint8)
    for i in range(len(alphas)):
        for j in range(i + 1, len(alphas)):
            nonopaque_overlap += ((alphas[i] >= 8) & (alphas[i] < 255) & (alphas[j] >= 8)).astype(np.uint8)
    target_h = round(DISPLAY_HEIGHT_CSS * DPR)
    target_w = round(c.viewbox[2] / c.viewbox[3] * target_h)
    box = (c.viewbox[0], c.viewbox[1], c.viewbox[0] + c.viewbox[2], c.viewbox[1] + c.viewbox[3])
    comp_small = comp.crop(box).resize((target_w, target_h), Image.Resampling.LANCZOS)
    ref_small = rgba(ROOT / c.reference).crop(box).resize((target_w, target_h), Image.Resampling.LANCZOS)
    ca, ra = np.asarray(comp_small), np.asarray(ref_small)
    small_delta = np.max(np.abs(ca[..., :3].astype(np.int16) - ra[..., :3].astype(np.int16)), axis=2)
    return {
        "canvas": [768, 768], "physical_size": [target_w, target_h],
        "comparison_pixels": int(mask.sum()),
        "rgb_diff_pixels": int((mask & (rgb_delta > 3)).sum()),
        "rgb_diff_max": int(rgb_delta[mask].max()),
        "alpha_diff_pixels": int((mask & (alpha_delta > 3)).sum()),
        "largest_rgb_diff_components": components(mask & (rgb_delta > 20), 8)[:8],
        "aa_overlap_px": int((nonopaque_overlap > 0).sum()),
        "aa_overlap_components": components(nonopaque_overlap > 0, 3)[:8],
        "downscale_rgb_diff_pixels": int((small_delta > 8).sum()),
        "downscale_rgb_diff_max": int(small_delta.max()),
        "downscale_diff_components": components(small_delta > 20, 2)[:8],
    }


def motion_report(c: Character) -> dict:
    base, _ = stack(c)
    b = np.asarray(base)
    base_alpha = b[..., 3]
    base_lum = lum(b)
    ref = np.asarray(rgba(ROOT / c.reference))
    silhouette = ref_alpha(ref) > 128
    result = {}
    for part, angles in c.endpoint_degrees.items():
        rows = []
        for deg in angles:
            pose, _ = stack(c, (part, deg))
            p = np.asarray(pose)
            pa, pl = p[..., 3], lum(p)
            # "silhouette_loss" catches an original filled pixel that becomes
            # transparent; it is a review candidate, not automatically a gap,
            # because limbs are allowed to move their outside contour.
            gap = silhouette & (base_alpha > 128) & (pa < 64)
            # This is the stricter actual-hole candidate used by vtest.
            enclosed = enclosed_transparent(pa) & (base_alpha > 128)
            # Darkening is only a PIL risk candidate, not a Chromium result.
            dark = (base_alpha > 128) & (pa > 128) & (pl < base_lum - 45) & (pl < 110)
            rows.append({"deg": deg, "silhouette_loss_px": int(gap.sum()),
                         "silhouette_loss_components": components(gap, 2)[:5],
                         "enclosed_gap_px": int(enclosed.sum()),
                         "enclosed_gap_components": components(enclosed, 2)[:5],
                         "dark_candidate_px": int(dark.sum()),
                         "dark_candidate_components": components(dark, 3)[:5]})
        result[part] = rows
    return result


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--character", choices=CHARACTERS, action="append")
    args = parser.parse_args()
    chosen = args.character or list(CHARACTERS)
    report = {c: {"static": static_report(CHARACTERS[c]), "motion": motion_report(CHARACTERS[c])} for c in chosen}
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

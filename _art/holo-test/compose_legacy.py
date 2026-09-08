"""Compose a small, deterministic preview set for the round-two legacy study.

The source card PNGs and clicker scene layers are read-only.  This script writes
only derived layer-{id}-{subject,background}.png files beside itself.
"""
from pathlib import Path
import hashlib, json, random
from PIL import Image, ImageEnhance, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent
SEED = 20260908
rng = random.Random(SEED)
SIZE = (600, 840)

# Human-readable pairing table: card id -> scene number / reason.
PAIRINGS = {
    "zhenpete": (1, "草地野餐；暖色角色放在開闊前景"),
    "zhenwang": (2, "布幕舞台；藍色稀有度呼應冷色背景"),
    "zhencao": (3, "標籤棚景；小體型角色留出天空層次"),
    "zhenjpg": (4, "戶外移動景；橙色角色在中景前"),
    "mieshi": (5, "夜色燈景；作為 bleed 滿版對照"),
    "wanwumythic": (6, "冷色庭院；作為 bleed 滿版對照"),
    "foxfriend": (6, "暖橙庭院；狐狸色調與夕光相配"),
    "miepupu": (1, "草地花叢；粉色主體與綠地反差"),
    "salamander": (2, "布幕舞台；長形主體放在地面線上"),
    "yangpu": (5, "燈籠夜景；小角色保留大量環境空間"),
}

def cover(img, size):
    scale = max(size[0] / img.width, size[1] / img.height)
    resized = img.resize((round(img.width * scale), round(img.height * scale)), Image.Resampling.LANCZOS)
    x = (resized.width - size[0]) // 2
    y = (resized.height - size[1]) // 2
    return resized.crop((x, y, x + size[0], y + size[1]))

def layer_fit(layer, width=600):
    scale = width / layer.width
    return layer.resize((width, round(layer.height * scale)), Image.Resampling.LANCZOS)

def scene_background(scene):
    sky = cover(Image.open(ROOT / f"src/clicker-scene{scene}-sky.png").convert("RGB"), SIZE).convert("RGBA")
    # The source layers are authored as a 1216px-wide stack.  Keep their natural
    # vertical order and anchor the near ground to the bottom of the card.
    stack = sky
    placements = [("far", 255), ("mid", 445), ("ground", 610)]
    for name, y in placements:
        path = ROOT / f"src/clicker-scene{scene}-{name}.png"
        if not path.exists():
            continue
        piece = layer_fit(Image.open(path).convert("RGBA"))
        # gentle fixed crop keeps the horizon centered but varies the seven scenes
        jitter = rng.randint(-10, 10)
        x = max(0, min(600 - piece.width, jitter))
        canvas = Image.new("RGBA", SIZE)
        canvas.alpha_composite(piece, (x, y))
        stack.alpha_composite(canvas)
    # Existing authored accent layers are safe to use; pick one of each class
    # when present so every output has a little scene-specific depth cue.
    for kind in ("cloud", "prop", "grass", "flower", "lantern", "cloth", "tag"):
        choices = sorted((ROOT / "src").glob(f"clicker-scene{scene}-{kind}-*.png"))
        if not choices:
            continue
        piece = Image.open(rng.choice(choices)).convert("RGBA")
        scale = min(1.0, 360 / max(piece.width, 1))
        piece = piece.resize((round(piece.width * scale), round(piece.height * scale)), Image.Resampling.LANCZOS)
        x = rng.randint(18, max(18, 600 - piece.width - 18))
        y = rng.randint(95, max(95, 690 - piece.height))
        stack.alpha_composite(piece, (x, y))
    return stack.convert("RGB")

def compose_subject(card_id, scene):
    src = Image.open(ROOT / f"src/card-{card_id}.png").convert("RGBA")
    bbox = src.getchannel("A").getbbox() or (0, 0, src.width, src.height)
    src = src.crop(bbox)
    # Fit by height first so no head is cropped; width cap avoids huge landscape
    # illustrations becoming a flat foreground wall.
    target_h = 485 if src.height >= 500 else 410
    scale = min(target_h / src.height, 0.78 * 600 / src.width)
    src = src.resize((round(src.width * scale), round(src.height * scale)), Image.Resampling.LANCZOS)
    # Put feet on the ground layer, with a stable, seeded side-to-side offset.
    x = max(12, min(600 - src.width - 12, (600 - src.width) // 2 + rng.randint(-32, 32)))
    y = 690 - src.height
    out = Image.new("RGBA", SIZE, (0, 0, 0, 0))
    out.alpha_composite(src, (x, y))
    return out

def main():
    records = []
    for card_id, (scene, reason) in PAIRINGS.items():
        bg = scene_background(scene)
        subject = compose_subject(card_id, scene)
        bg.save(OUT / f"layer-{card_id}-background.png", optimize=True)
        subject.save(OUT / f"layer-{card_id}-subject.png", optimize=True)
        records.append({"id": card_id, "scene": scene, "reason": reason,
                        "background_sha256": hashlib.sha256((OUT / f"layer-{card_id}-background.png").read_bytes()).hexdigest(),
                        "subject_sha256": hashlib.sha256((OUT / f"layer-{card_id}-subject.png").read_bytes()).hexdigest(),
                        "size": list(SIZE)})
    (OUT / "legacy-compose-manifest.json").write_text(json.dumps({"seed": SEED, "pairings": records}, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Generated {len(records)} legacy pairs with seed {SEED}.")

if __name__ == "__main__":
    main()

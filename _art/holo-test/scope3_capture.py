"""Shared evidence identity and controlled capture helpers (no product overrides)."""
import hashlib
from pathlib import Path

SCOPE = ('gacha', 'gacha-standalone', 'gacha-test', 'gacha-test-standalone',
         'pool', 'pool-standalone', 'team')


def artifact_hashes(root, exclude=None):
    root = Path(root)
    return {p.relative_to(root).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest()
            for p in sorted(root.rglob('*')) if p.is_file()
            and p.suffix.lower() in ('.html', '.js', '.css', '.png', '.webp', '.woff2')
            and 'node_modules' not in p.parts
            and (exclude is None or not p.is_relative_to(Path(exclude)))}


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def tool_hashes():
    root = Path(__file__).resolve().parent
    return {name: digest(root / name) for name in ('scope3_capture.py','scope3_layers.py','scope3_transfer.py',
            'check_card_parity.py','shoot_card_parity_samesize.py','check_shot_determinism.py')}


def refit(pg, script):
    result = pg.evaluate(script)
    if not isinstance(result, dict) or result.get('errors'):
        raise RuntimeError('decode/refit failed: %r' % result)
    return result

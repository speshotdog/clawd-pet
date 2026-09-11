"""Refresh only formal demo data; historical specimens stay explicit overrides."""
from pathlib import Path
import json
import re
from pool_data import pool, SCENE_CARDS


def update():
    path = Path(__file__).with_name('demo.html')
    html = path.read_text(encoding='utf-8')
    for name, value in [('sceneData', SCENE_CARDS), ('poolData', pool(with_scenes=False))]:
        html, count = re.subn(r'const ' + name + r'=\[.*?\];',
                            lambda _: 'const ' + name + '=' + json.dumps(value, ensure_ascii=False) + ';',
                            html, count=1, flags=re.S)
        assert count == 1, name
    path.write_text(html, encoding='utf-8')


if __name__ == '__main__':
    update()
    from card_assets import build
    build()
    print('demo: 43 formal pool records + 4 scenes refreshed; historical data retained')

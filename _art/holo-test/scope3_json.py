"""Read full evidence without requiring a large uncompressed file in Git."""
import gzip
import json
from pathlib import Path


def resolve_input(path):
    path=Path(path)
    if not path.exists() and Path(str(path)+'.gz').exists():
        path=Path(str(path)+'.gz')
    return path


def read_json(path):
    path=resolve_input(path)
    opener=gzip.open if path.suffix=='.gz' else open
    with opener(path,'rt',encoding='utf-8') as stream:
        return json.load(stream)

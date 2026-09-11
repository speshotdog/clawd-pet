# -*- coding: utf-8 -*-
"""技能挑選卡片化＋拖曳的驗收（ORDER-2026-09-12-picker-drag.md 命令 2／4／6／8）。

  --snapshot            施工前快照：HEAD、工作區、受保護檔與待修改來源的 SHA-256、既有 acceptance.json、產物 SHA-256
  --suite picker        挑選器：三模式 × 三 viewport，每格一張 .hcard、24/24 可達、開關 20 次無殘留
  --suite drag          拖曳：桌面兩尺寸 × 20 成員 × 4 格、8px 門檻、非目標／Escape／神話拒絕、手機不拖
  --suite pixels        挑選器卡面 vs 總覽卡面 同尺寸中性姿態像素比對
  --suite negative      反例：少卡／錯階級墨色／錯技能格／實際選區覆色 各自被拒
  --suite perf          拖曳中與挑選器 rAF 間隔取樣
  --suite entry-pixels  逐組呼叫 check_shot_determinism.py 與 shoot_card_parity_samesize.py

所有輸出只寫進 --out；已存在同名證據即報錯，不覆寫。
"""
import argparse, hashlib, json, subprocess, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]

PROTECTED_BASELINE = ROOT / 'docs/clicker/shots/team-round3/protected-before.json'
SOURCES_TO_MODIFY = ['_art/holo-test/team20.js', '_art/holo-test/team20.css', '_art/holo-test/map20.template.html',
                     '_art/holo-test/check_team20.py', '_art/holo-test/check_card_corners.py', '_art/holo-test/check_map20.py']
FORBIDDEN_SOURCES = ['_art/holo-test/card_face.js', '_art/holo-test/pool_data.py', '_art/holo-test/card_assets.py',
                     '_art/holo-test/demo.html', '_art/holo-test/build_deluxe_b.py', '_art/holo-test/build_deluxe_b_standalone.py',
                     '_art/holo-test/build_cards_remade.py', '_art/holo-test/build_cards_remade_standalone.py',
                     '_art/holo-test/build_map20.py', 'src/clicker-save.js']
ARTIFACTS = ['_art/holo-test/map20.html', '_art/holo-test/cards-remade.html', '_art/holo-test/cards-remade-standalone.html',
             '_art/holo-test/deluxe-gacha-b.html', '_art/holo-test/deluxe-gacha-b-standalone.html',
             '_art/holo-test/deluxe-gacha-b-test.html', '_art/holo-test/deluxe-gacha-b-test-standalone.html']


def sha(p: Path):
    return hashlib.sha256(p.read_bytes()).hexdigest() if p.exists() else None


def git(*args):
    return subprocess.run(['git', *args], cwd=ROOT, capture_output=True, text=True, encoding='utf-8').stdout.strip()


def fresh_dir(out: Path, names):
    out.mkdir(parents=True, exist_ok=True)
    clash = [n for n in names if (out / n).exists()]
    if clash:
        raise SystemExit(f'!! 既有證據不可覆寫：{[str(out / n) for n in clash]}')


def snapshot(out: Path):
    fresh_dir(out, ['snapshot.json', 'protected-before.json'])
    protected = json.loads(PROTECTED_BASELINE.read_text(encoding='utf-8'))
    protected_now = {k: sha(ROOT / k) for k in protected}
    sources = {k: sha(ROOT / k) for k in SOURCES_TO_MODIFY}
    forbidden = {k: sha(ROOT / k) for k in FORBIDDEN_SOURCES}
    artifacts = {k: sha(ROOT / k) for k in ARTIFACTS}
    acceptance_path = ROOT / 'docs/clicker/shots/team-round3/acceptance.json'
    acceptance = json.loads(acceptance_path.read_text(encoding='utf-8'))
    checks = acceptance['checks']
    counts = {s: sum(c['status'] == s for c in checks.values()) for s in ['PASS', 'FAIL', 'NEEDS_DEVICE', 'BASELINE']}
    failed = {k: {'values': v.get('values'), 'range': v.get('range')} for k, v in checks.items() if v['status'] == 'FAIL'}
    snap = {
        'head': git('rev-parse', '--short', 'HEAD'),
        'head_full': git('rev-parse', 'HEAD'),
        'branch': git('rev-parse', '--abbrev-ref', 'HEAD'),
        'status_short': git('status', '--short').splitlines(),
        'protected_baseline_source': str(PROTECTED_BASELINE.relative_to(ROOT)),
        'protected_changed_vs_baseline': [k for k, h in protected.items() if protected_now[k] != h],
        'sources_to_modify': sources,
        'forbidden_sources': forbidden,
        'artifacts': artifacts,
        'acceptance': {'source': str(acceptance_path.relative_to(ROOT)), 'counts': counts, 'failed': failed,
                       'checks': {k: v['status'] for k, v in checks.items()}},
    }
    (out / 'snapshot.json').write_text(json.dumps(snap, ensure_ascii=False, indent=2), encoding='utf-8')
    # 本輪自己的受保護 manifest：歷史 baseline 的檔 + 本輪禁改來源，全部取施工前的現值
    manifest = {k.replace(chr(92), '/'): v for k, v in {**protected_now, **forbidden}.items()}  # 路徑統一斜線，避免同檔算兩次
    (out / 'protected-before.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({'head': snap['head'], 'branch': snap['branch'], 'dirty': len(snap['status_short']),
                      'protected_changed_vs_baseline': snap['protected_changed_vs_baseline'],
                      'acceptance_counts': counts, 'failed': list(failed)}, ensure_ascii=False, indent=2))
    return 0


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--snapshot', action='store_true')
    ap.add_argument('--suite', choices=['picker', 'drag', 'pixels', 'negative', 'perf', 'entry-pixels'])
    ap.add_argument('--out', type=Path, required=True)
    ap.add_argument('--channel', choices=['chrome', 'msedge'])
    args = ap.parse_args()
    out = args.out.resolve()
    if args.snapshot:
        return snapshot(out)
    if args.suite:
        from picker_drag_suites import run_suite
        return run_suite(args.suite, out, channel=args.channel)
    ap.error('需要 --snapshot 或 --suite')


if __name__ == '__main__':
    sys.exit(main())

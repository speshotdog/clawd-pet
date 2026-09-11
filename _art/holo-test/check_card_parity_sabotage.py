# -*- coding: utf-8 -*-
"""記憶體負控制：把一份合格的 parity JSON 照既知的手法弄壞，正式判定器必須非零退出。

這些破壞手法都是 Astra 在 2026-09-11 兩輪驗收裡示範出來的假通過。
每一種都從原始 JSON 複製後**單獨**破壞，不改判定器。

用法：
    python check_card_parity_sabotage.py --input <合格的 parity-*.json>
"""
from __future__ import annotations
import argparse, copy, json, subprocess, sys, io
from pathlib import Path
from scope3_json import read_json,resolve_input
from scope3_capture import digest

_OUT = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace', line_buffering=True)
sys.stdout = _OUT
HERE = Path(__file__).resolve().parent


def drop_entry(d):
    d['entries'].pop('pool', None)


def drop_card(d):
    for vp in d['entries']['pool']['viewports'].values():
        vp['cards'] = [c for c in vp['cards'] if c.get('canonicalId') != 'rocketdog']


def drop_detail(d):
    for vp in d['entries']['team']['viewports'].values():
        vp['cards'] = [c for c in vp['cards'] if c.get('role') != 'detail']


def blank_required(d):
    for vp in d['entries']['pool']['viewports'].values():
        for c in vp['cards']:
            c['visible'] = False
            c['rarityFsVar'] = c['nameFsVar'] = ''
            c['rarityRange'] = None


def shrink_manifest(d):
    """連 JSON 自帶的預期清單一起改小——判定器若讀它就會跟著瞎掉。"""
    d['expectedPoolIds'] = [i for i in d.get('expectedPoolIds', []) if i != 'rocketdog']
    for vp in d['entries']['pool']['viewports'].values():
        vp['cards'] = [c for c in vp['cards'] if c.get('canonicalId') != 'rocketdog']


def hollow_geometry(d):
    """物件還在，裡面的欄位掏空。"""
    for vp in d['entries']['pool']['viewports'].values():
        for c in vp['cards']:
            c['rarityClear'] = {'missing': True}
            c['nameClear'] = {'missing': True}
            c.pop('lineGap', None)
            c.pop('gemOverlapArea', None)


def clone_one_slot(d):
    """十連變成同一槽複製十份。"""
    for vp in d['entries']['gacha']['viewports'].values():
        for pose in ('native', 'neutral'):
            rows = [c for c in vp['cards'] if c.get('pose', 'native') == pose]
            if not rows:
                continue
            others = [c for c in vp['cards'] if c.get('pose', 'native') != pose]
            vp['cards'] = others + [copy.deepcopy(rows[0]) for _ in range(len(rows))]


def zero_complete(d):
    for vp in d['entries']['gacha-test']['viewports'].values():
        for b in (vp.get('activation') or {}).get('ceremony') or []:
            b['complete'] = 0


def detail_offscreen(d):
    for vp in d['entries']['team']['viewports'].values():
        for c in vp['cards']:
            if c.get('role') == 'detail':
                c['inViewport'] = False


CASES = [
    ('drop-entry', '刪掉整個 pool 入口', drop_entry),
    ('drop-card', '刪掉 pool 的 rocketdog', drop_card),
    ('drop-detail', '刪掉編隊全部手機詳情', drop_detail),
    ('blank-required', 'pool 全標不可見＋清必填', blank_required),
    ('shrink-manifest', '連 JSON 自帶的預期清單一起改小', shrink_manifest),
    ('hollow-geometry', '幾何物件在、內層欄位掏空', hollow_geometry),
    ('clone-one-slot', '十連變成同一槽複製十份', clone_one_slot),
    ('zero-complete', '固定抽卡 complete 改成 0', zero_complete),
    ('detail-offscreen', '詳情全部標成視窗外', detail_offscreen),
]


# ---- 2026-09-11 第二批：Astra 在 VERDICT-v4 示範的五種 ----

def drop_error_fields(d):
    """錯誤採集欄位整個消失——缺 key 不能被當成空清單。"""
    for e in d['entries'].values():
        for vp in (e.get('viewports') or {}).values():
            vp.pop('pageErrors', None)
            vp.pop('brokenImages', None)


def drop_instance(d):
    for e in d['entries'].values():
        for vp in (e.get('viewports') or {}).values():
            for c in vp.get('cards', []):
                c.pop('instance', None)


def drop_design_keys(d):
    for e in d['entries'].values():
        for vp in (e.get('viewports') or {}).values():
            for c in vp.get('cards', []):
                for part in ('nameStyle', 'rarityStyle'):
                    if isinstance(c.get(part), dict):
                        c[part].pop('fontWeight', None)
                if isinstance(c.get('frame'), dict):
                    c['frame'].pop('backgroundImage', None)


def truncate_fixture(d):
    d['fixtureIds'] = d['fixtureIds'][:10]
    for name in ('gacha-test', 'gacha-test-standalone'):
        for rec in d['entries'][name]['viewports'].values():
            rec['activation']['ceremony'] = rec['activation']['ceremony'][:1]


def clone_neutral(d):
    for vp in d['entries']['gacha']['viewports'].values():
        for c in vp['cards']:
            if c.get('pose')=='neutral':c['instance']=999


def nan_values(d):
    for vp in d['entries']['pool']['viewports'].values():
        for c in vp['cards']:
            if isinstance(c.get('rarityClear'), dict):
                c['rarityClear']['left'] = float('nan')


CASES += [
    ('drop-error-fields', '錯誤採集欄位整個消失', drop_error_fields),
    ('drop-instance', '實例序號消失', drop_instance),
    ('drop-design-keys', '必驗設計欄位消失', drop_design_keys),
    ('truncate-fixture', '固定揭卡證據只剩第一批', truncate_fixture),
    ('clone-neutral', '中性姿態全換成第一筆複本', clone_neutral),
    ('nan-values', '幾何值改成 NaN', nan_values),
]


def records(d):
    return [r for e in d['entries'].values() for r in e['viewports'].values()]

def cards(d):
    return [c for r in records(d) for c in r['cards']]

def set_errors_null(d):
    for r in records(d): r['pageErrors']=None;r['brokenImages']=None

def null_styles(d):
    for c in cards(d):
        c['nameStyle']['fontWeight']=None;c['rarityStyle']['fontWeight']=None;c['frame']['backgroundImage']=None

def empty_text_fonts(d):
    for c in cards(d):
        c.pop('nameText',None);c.pop('rarityText',None)
        for p in c['platformFonts'].values():p['fonts']=[]

def absent_batch(d):
    for c in cards(d):c.pop('batch',None)

def collapse_batch(d):
    for r in d['entries']['gacha-test']['viewports'].values():
        for c in r['cards']:c['batch']=0

def name_array(d):
    for c in cards(d):c['nameRange']=[]

def name_geometry(d):
    for r in d['entries']['team']['viewports'].values():
        for c in r['cards']:c['nameRange']={'w':9999,'h':9999,'lines':99};c['nameFits']='false'

def css_nan(d):
    for c in cards(d):c['rarityFsVar']='NaNpx'

def one_pixel_detail(d):
    for vp,r in d['entries']['team']['viewports'].items():
        for c in r['cards']:
            if c['role']=='detail' and c.get('pose','native')=='native':c['box']['y']=int(vp.split('x')[1])-1;c['inViewport']=True

def mutate_layer(d,field,key,value):
    r=next(iter(d['entries']['pool']['viewports'].values()))
    c=next(c for c in r['cards'] if c.get('pose')=='neutral')
    c['layers'][0][field][key]=value

CASES += [
 ('null-errors','null error arrays',set_errors_null),
 ('null-styles','null CSS values',null_styles),
 ('empty-text-fonts','missing text and fonts',empty_text_fonts),
 ('missing-batch','no sample batch',absent_batch),
 ('collapsed-batch','all samples in batch zero',collapse_batch),
 ('name-array','geometry wrong type',name_array),
 ('name-geometry','invalid name dimensions and fit',name_geometry),
 ('css-nan','NaN inside CSS string',css_nan),
 ('one-pixel-detail','only one pixel inside viewport',one_pixel_detail),
 ('decode-failure','recorded decode failure',lambda d: records(d)[0]['captureDiagnostics'][0]['errors'].append({'stage':'decode','error':'injected'})),
 ('refit-failure','recorded refit failure',lambda d: records(d)[0]['captureDiagnostics'][0]['errors'].append({'stage':'refit','error':'injected'})),
 ('stale-artifact','wrong source hash',lambda d: d['sourceHashes'].update({'map20.html':'bad'})),
 ('stale-shot','wrong screenshot hash',lambda d: records(d)[0]['screenshot'].update({'sha256':'bad'})),
 ('empty-layers','missing component tree',lambda d: [c.update(layers=[]) for c in cards(d)]),
 ('gradient-content','changed complete gradient',lambda d: mutate_layer(d,'style','backgroundImage','linear-gradient(red,blue)')),
 ('mask-content','changed mask content',lambda d: mutate_layer(d,'style','maskImage','url(sha256:bad)')),
 ('pseudo-element','changed pseudo element',lambda d: mutate_layer(d,'before','backgroundImage','linear-gradient(red,blue)')),
 ('internal-transform','changed internal design transform',lambda d: mutate_layer(d,'style','transform','matrix(2,0,0,2,0,0)')),
 ('bad-glyph-count','empty glyph evidence',lambda d: cards(d)[0]['platformFonts']['name']['fonts'][0].update(glyphCount=0)),
 ('boolean-geometry','boolean instead of number',lambda d: cards(d)[0]['nameRange'].update(w=True)),
 ('zero-name','invisible name width',lambda d: cards(d)[0]['nameRange'].update(w=0)),
 ('slot-mismatch','duplicate batch slot',lambda d: d['entries']['gacha-test']['viewports']['1440x1200']['cards'][1].update(slot=0)),
]


def all_neutral(d):
    return [c for c in cards(d) if c.get('pose')=='neutral']

def drop_layer_key(d):
    for c in all_neutral(d):
        for layer in c['layers']:
            layer['style'].pop('backgroundColor',None)

def duplicate_pool(d):
    r=next(iter(d['entries']['pool']['viewports'].values()))
    for pose in ('native','neutral'):
        r['cards'].append(copy.deepcopy(next(c for c in r['cards'] if c.get('pose','native')==pose)))

def zero_image(d):
    c=all_neutral(d)[0]
    next(l for l in c['layers'] if l['tag']=='IMG')['image']['width']=0

def mobile_gradient(d):
    for entry in d['entries'].values():
        for c in entry['viewports']['390x844']['cards']:
            if c.get('pose')=='neutral':c['layers'][0]['style']['backgroundImage']='linear-gradient(red,blue)'

CASES += [
 ('drop-layer-key','missing full style key in every entry',drop_layer_key),
 ('duplicate-pool','duplicate native and neutral sample',duplicate_pool),
 ('zero-image','invalid intrinsic image size',zero_image),
 ('malformed-layer','invalid layer object',lambda d: all_neutral(d)[0]['layers'].__setitem__(0,None)),
 ('malformed-fonts','invalid font evidence object',lambda d: cards(d)[0].update(platformFonts=[])),
 ('wrong-sample-location','sample record metadata mismatch',lambda d: cards(d)[0].update(viewport='1x1')),
 ('assets-drop-team','asset checker: entire team entry missing',lambda d: d['entries'].pop('team')),
 ('assets-only-reference','asset checker: only reference remains',lambda d: d.update(entries={'gacha-test':d['entries']['gacha-test']})),
 ('assets-drop-viewport','asset checker: team viewport missing',lambda d: d['entries']['team']['viewports'].pop('1440x1200')),
 ('assets-drop-detail','asset checker: team detail role missing',drop_detail),
 ('malformed-decode-evidence','decoded image has no dimensions',lambda d: records(d)[0]['captureDiagnostics'][0]['decoded'].__setitem__(0,{})),
 ('duplicate-decode-evidence','duplicate decoded image index',lambda d: records(d)[0]['captureDiagnostics'][0]['decoded'].append(copy.deepcopy(records(d)[0]['captureDiagnostics'][0]['decoded'][0]))),
 ('wrong-controlled-width','false controlled width metadata',lambda d: all_neutral(d)[0].update(contentWidth=200)),
 ('wrong-kind','card kind contradicts source',lambda d: cards(d)[0].update(kind='invented')),
 ('wrong-card-id','card ID contradicts canonical ID',lambda d: cards(d)[0].update(id='invented')),
 ('mobile-gradient','all mobile entries drift together',mobile_gradient),
 ('oversized-fitting-name','impossible name range marked fitting',lambda d: [c.update(nameRange={'w':9999,'h':9999,'lines':1},nameFits='true') for c in cards(d)]),
]


def different_encoding(d):
    # Different lossless encoding: decoded pixels are EXACTLY equal, bytes are not.
    import base64, hashlib, io
    from PIL import Image
    from card_assets import assets
    row=d['assetIdentity']['pool'][0]
    raw=base64.b64decode(assets()[row['key']].split(',',1)[1])
    im=Image.open(io.BytesIO(raw)).convert('RGBA')
    buf=io.BytesIO();im.save(buf,'PNG')
    assert Image.open(io.BytesIO(buf.getvalue())).convert('RGBA').tobytes()==im.tobytes()
    row.update(sha256=hashlib.sha256(buf.getvalue()).hexdigest(), identical=False, pixelsEqual=True)

CASES.extend([
    ('different-encoding-identical-pixels','different encoded bytes even with zero pixel error',different_encoding),
    ('missing-asset-identity','missing byte identity evidence',lambda d:d.pop('assetIdentity')),
])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--input', required=True)
    ap.add_argument('--out',type=Path)
    ap.add_argument('--reference', default='gacha-test')
    ap.add_argument('--worker', choices=['clean']+[label for label,_,_ in CASES], help=argparse.SUPPRESS)
    args = ap.parse_args()
    src_path = Path(args.input)
    out_dir = args.out or src_path.parent
    out_dir.mkdir(parents=True,exist_ok=True)
    if args.worker:
        # Every child loads the unchanged source independently. Only the selected
        # counterexample mutates it; the actual report main determines process exit.
        src = read_json(src_path)
        if args.worker != 'clean':
            next(fn for label,_,fn in CASES if label==args.worker)(src)
        if args.worker.startswith('assets-'):
            from check_card_assets import evaluate
            result=evaluate(src)
            print('PASS' if result['pass'] else 'FAIL','asset checker',result['comparisons'],'comparisons',result['differences'],'differences')
            return 0 if result['pass'] else 1
        from check_card_parity_report import main as report
        return report(['--input',str(src_path),'--reference',args.reference],data=src)

    def run(label):
        r = subprocess.run([sys.executable, str(Path(__file__).resolve()),
                            '--input', str(src_path), '--reference', args.reference,'--worker',label],
                           capture_output=True)
        text = r.stdout.decode('utf-8', 'replace')
        if r.stderr: text += '\nSTDERR: '+r.stderr.decode('utf-8','replace')
        (out_dir / ('report-sabotage-%s.log' % label)).write_text(text, encoding='utf-8')
        return r.returncode, sum(1 for l in text.splitlines() if l.startswith('FAIL '))

    source_hash=digest(resolve_input(src_path))
    rc0, n0 = run('clean')
    print('%-18s %-28s exit=%d FAIL=%d  %s' % ('clean', '未破壞的對照', rc0, n0,
                                               'OK' if rc0 == 0 else '⚠ 乾淨的就不過，先修這個'))
    if rc0 != 0 or n0 != 0:
        print('FAIL clean control failed; sabotage results would not be valid')
        return 1
    bad = []
    results=[]
    for label, desc, fn in CASES:
        rc, n = run(label)
        ok = rc == 1 and n > 0 and n0 == 0
        if not ok:
            bad.append(label)
        results.append({'case':label,'exit':rc,'failAssertions':n,'pass':ok})
        print('%-18s %-28s exit=%d FAIL=%d  %s' % (label, desc, rc, n, 'OK' if ok else '⚠ 假通過'))
    print()
    print('結果：%d/%d 種破壞被擋下' % (len(CASES) - len(bad), len(CASES)))
    unchanged=source_hash==digest(resolve_input(src_path))
    summary={'cleanExit':rc0,'sourceSha256':source_hash,'sourceUnchanged':unchanged,'cases':results,
             'pass':rc0==0 and not bad and unchanged}
    (out_dir/'sabotage-summary-scope3.json').write_text(json.dumps(summary,indent=2),encoding='utf-8')
    return 0 if summary['pass'] else 1


if __name__ == '__main__':
    sys.exit(main())

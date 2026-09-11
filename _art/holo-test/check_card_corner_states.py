# -*- coding: utf-8 -*-
"""多狀態黑角掃描（ORDER-2026-09-12-picker-drag.md 命令 3／7）。

  --self-test                 用合成頁驗儀器：亮背景深框卡誤報 0、四個單角黑塊 4/4、零樣本 SKIP、DPR 2、遮擋、投影幾何
  --suite all                 卡冊／揭卡（真實控制器）／編隊（總覽、選取、hover、詳情、三種挑選模式）／拖曳（成立、中途、目標上方、放下）
  --channel chrome|msedge     系統瀏覽器（--headless=new），可配 --gpu d3d11；未達要求的 renderer 記 NEEDS_DEVICE
  --dprs 1,1.25,1.5,2
  --out 目錄                  只寫這裡；同名證據已存在即報錯

每個狀態逐張、逐角記有效樣本與跳過原因；必測狀態零有效樣本＝覆蓋缺口（exit 1），不算通過。
"""
import argparse, json, sys, time
from pathlib import Path
from PIL import Image
from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from check_card_corners import measure_corners, collect_geometry, INJECT_JS  # noqa: E402

RAF2 = "()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))"
FREEZE = ("()=>[document,...[...document.querySelectorAll('*')].filter(e=>e.shadowRoot).map(e=>e.shadowRoot)]"
          ".forEach(root=>root.getAnimations().forEach(a=>{try{a.pause()}catch{}}))")
RENDERER_JS = ("()=>{const gl=document.createElement('canvas').getContext('webgl');if(!gl)return 'no-webgl';"
               "const e=gl.getExtension('WEBGL_debug_renderer_info');return e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)}")

# 必測狀態（缺一即覆蓋缺口）。拖曳狀態在功能落地前由 suite 依 team20.drag 是否存在決定是否必測。
REQUIRED_STATES = [
    'pool-static', 'pool-hover', 'pool-standalone-static',
    'gacha-reveal-face', 'gacha-results', 'gacha-results-hover', 'gacha-results-click',
    'gacha-standalone-results',
    'team-desk-overview', 'team-desk-selected', 'team-desk-hover', 'team-desk-detail',
    'team-desk-picker-skill', 'team-desk-picker-add', 'team-desk-picker-replace',
    'team-tablet-overview', 'team-tablet-selected',
    'team-phone-overview', 'team-phone-selected', 'team-phone-picker-skill',
]
DRAG_STATES_PER_KIND = ['drag-start', 'drag-mid', 'drag-over-slot', 'drop-first-raf', 'drop-stable']


def fresh(out: Path, *names):
    out.mkdir(parents=True, exist_ok=True)
    clash = [n for n in names if (out / n).exists()]
    if clash:
        raise SystemExit(f'!! 既有證據不可覆寫：{[str(out / n) for n in clash]}')


class Scanner:
    def __init__(self, out: Path, dpr: float, fraction=8, darkest=12, tag=''):
        self.out, self.dpr, self.fraction, self.darkest, self.tag = out, dpr, fraction, darkest, tag
        self.states = []

    def shoot(self, pg, name, freeze=True, inject=False, required=True):
        if freeze:
            pg.evaluate(FREEZE)
        pg.evaluate(RAF2)
        full = f'{self.tag}{name}'
        path = self.out / f'{full}.png'
        pg.screenshot(path=str(path))
        cards = collect_geometry(pg)
        m = measure_corners(Image.open(path), cards, fraction=self.fraction, darkest_limit=self.darkest, dpr=self.dpr)
        rec = dict(state=name, tag=self.tag, dpr=self.dpr, inject=inject, required=required, cards=len(cards),
                   samples=m['samples'], bad=m['bad'], status=m['status'], skipped=m['skipped'],
                   invalid=[r for r in m['rows'] if r['much_darker_pct'] is None],
                   bad_rows=[r for r in m['rows'] if r['much_darker_pct'] is not None and r['much_darker_pct'] >= self.fraction and r['darkest'] <= self.darkest],
                   worst=sorted([r for r in m['rows'] if r['much_darker_pct'] is not None], key=lambda r: -r['much_darker_pct'])[:3],
                   geometry=cards, png=path.name,
                   ghost_cards=sum(1 for c in cards if c.get('ghost')),
                   ghost_valid=sum(1 for r in m['rows'] if r['much_darker_pct'] is not None and cards[r['card']].get('ghost')),
                   ghost_skipped=[(i, why) for i, why in m['skipped'] if cards[i].get('ghost')])
        self.states.append(rec)
        g = f" ghost={rec['ghost_valid']}/{rec['ghost_cards']*4}" if rec['ghost_cards'] else ''
        print(f"{full:44s} cards={len(cards):3d} valid={m['samples']:3d} skip={len(m['skipped']):3d} invalid={len(rec['invalid']):3d} bad={m['bad']:3d} {m['status']}{g}")
        return rec


# ------------------------------------------------------------------ 正式狀態
def fixture_cards():
    from pool_data import pool
    allc = pool(); byr = {}
    for c in allc:
        byr.setdefault(c['rarity'], []).append(c)
    fx = []
    for r in ['mythic', 'legendary', 'epic', 'rare', 'common']:
        fx += byr.get(r, [])[:2]
    return fx[:10]


def scan_pool(br, sc, dpr):
    for f, tag in [('cards-remade.html', 'pool'), ('cards-remade-standalone.html', 'pool-standalone')]:
        pg = br.new_page(viewport={'width': 1440, 'height': 4200}, device_scale_factor=dpr)
        pg.goto((HERE / f).as_uri()); pg.wait_for_timeout(2500)
        sc.shoot(pg, f'{tag}-static')
        if tag == 'pool':
            cs = collect_geometry(pg)
            if cs:
                c = cs[2] if len(cs) > 2 else cs[0]
                pg.mouse.move(c['x'] + c['w'] * .7, c['y'] + c['h'] * .3); pg.wait_for_timeout(450)
                sc.shoot(pg, f'{tag}-hover')
        pg.close()


def scan_gacha(br, sc, dpr):
    fx = fixture_cards()
    for f, tag in [('deluxe-gacha-b-test.html', 'gacha'), ('deluxe-gacha-b-test-standalone.html', 'gacha-standalone')]:
        pg = br.new_page(viewport={'width': 1440, 'height': 900}, device_scale_factor=dpr)
        pg.goto((HERE / f).as_uri() + '?ceremony-test'); pg.wait_for_timeout(1000)
        pg.evaluate("(c)=>{__ceremony.reset();window.__ceremonyFixture=c;__ceremony.pull(c.length)}", fx)
        # 真實控制器：等 openPack 接受（entryPhase=waiting）才算到卡包畫面
        pg.wait_for_function("()=>__ceremony.state().entryPhase==='waiting'", timeout=20000)
        if tag == 'gacha':
            sc.shoot(pg, f'{tag}-pack', freeze=False, required=False)  # 卡包畫面沒有卡面，只留紀錄
        pg.evaluate("()=>__ceremony.openPack()")
        # 演出時點：第一張卡面翻開（commitFaceVisible）之後 350ms
        pg.evaluate("""()=>new Promise(res=>{const t0=Date.now();(function poll(){const s=document.querySelector('.slot.is-revealing');const f=s&&s.querySelector('.hcard');
          if(f&&getComputedStyle(f).visibility==='visible'){res(1);return} if(Date.now()-t0>20000){res(0);return} setTimeout(poll,16)})()})""")
        pg.wait_for_timeout(350)
        if tag == 'gacha':
            sc.shoot(pg, f'{tag}-reveal-face', freeze=False)
        pg.evaluate("()=>__ceremony.skipAll()")
        try:
            pg.evaluate("async()=>{await __ceremony.ready()}")
        except Exception:
            pass
        pg.wait_for_function("()=>__ceremony.state().screen==='results'&&__ceremony.state().complete===__ceremony.state().ids.length", timeout=20000)
        pg.wait_for_timeout(600)
        sc.shoot(pg, f'{tag}-results')
        if tag == 'gacha':
            cs = collect_geometry(pg)
            if cs:
                c = cs[0]
                pg.mouse.move(c['x'] + c['w'] * .7, c['y'] + c['h'] * .3); pg.wait_for_timeout(500)
                sc.shoot(pg, f'{tag}-results-hover')
                pg.mouse.click(c['x'] + c['w'] * .5, c['y'] + c['h'] * .5); pg.wait_for_timeout(900)
                sc.shoot(pg, f'{tag}-results-click')
        pg.close()


def open_team(pg):
    pg.goto((HERE / 'map20.html').as_uri()); pg.wait_for_timeout(1500)
    pg.click('#open-team'); pg.wait_for_timeout(1500)


def scan_team(br, sc, dpr):
    for vw, vh, vt in [(1440, 900, 'desk'), (1024, 768, 'tablet'), (390, 844, 'phone')]:
        pg = br.new_page(viewport={'width': vw, 'height': vh}, device_scale_factor=dpr)
        open_team(pg)
        sc.shoot(pg, f'team-{vt}-overview')
        pg.evaluate("()=>{const t=window.team20;t.select(t.roster[1],true)}"); pg.wait_for_timeout(900)
        sc.shoot(pg, f'team-{vt}-selected')
        if vt == 'desk':
            cs = collect_geometry(pg)
            if cs:
                c = cs[-1]; pg.mouse.move(c['x'] + c['w'] * .7, c['y'] + c['h'] * .3); pg.wait_for_timeout(500)
                sc.shoot(pg, f'team-{vt}-hover')
            pg.evaluate("()=>document.querySelector('#card-host')?.scrollIntoView({block:'center'})"); pg.wait_for_timeout(300)
            sc.shoot(pg, f'team-{vt}-detail')
        for mode in (['skill', 'add', 'replace'] if vt == 'desk' else (['skill'] if vt == 'phone' else [])):
            pg.evaluate("(m)=>window.team20.openPicker(m,0)", mode); pg.wait_for_timeout(1200)
            sc.shoot(pg, f'team-{vt}-picker-{mode}')
            pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
        pg.close()


DRAG_KINDS = ['depth', 'framed', 'flat']
DRAG_VIEWPORTS = [(1440, 900, 'desk'), (1024, 768, 'tablet')]


def drag_required():
    """固定必測矩陣：3 卡型 × 2 桌面 viewport × 5 時點，不由實際跑到的清單反推。"""
    return [f'drag-{vt}-{k}-{st}' for _, _, vt in DRAG_VIEWPORTS for k in DRAG_KINDS for st in DRAG_STATES_PER_KIND]


def scan_drag(br, sc, dpr):
    """拖曳：depth／framed／flat 各一張 × 兩桌面 viewport × 成立／中途／目標上方；放下後第一個 rAF 與雙 rAF 穩定畫面。

    ghost 的覆蓋以 ghost 本身的有效角判（rec['ghost_valid']），不用同畫面其他卡的樣本充數。
    抓取點放在卡面偏下（88% 高），ghost 懸在技能格上時整張留在視窗內，否則背景環出界會被整張 SKIP。
    """
    done = []
    for vw, vh, vt in DRAG_VIEWPORTS:
        pg = br.new_page(viewport={'width': vw, 'height': vh}, device_scale_factor=dpr)
        open_team(pg)
        if not pg.evaluate("()=>!!(window.team20&&window.team20.drag)"):
            pg.close(); return done
        for kind in DRAG_KINDS:
            pg.evaluate("()=>window.team20.reset()"); pg.wait_for_timeout(300)
            # fixture：該卡型若不在 roster，以同稀有度成員換入（公開 API），再翻到它所在的頁
            cid = pg.evaluate("""(kind)=>{const t=window.team20;const K=c=>c.kind||(c.scene?'depth':(c.bleed?'flat':'framed'));
              let c=t.roster.map(id=>t.cards.find(x=>x.id===id)).find(c=>K(c)===kind);
              if(!c){c=t.cards.find(x=>K(x)===kind);if(!c)return null;
                const same=t.roster.find(r=>t.cards.find(y=>y.id===r).rarity===c.rarity);if(!same||!t.add(c.id,same))return null}
              const i=t.roster.indexOf(c.id);t.showPage(Math.floor(i/10));return c.id}""", kind)
            if not cid:
                print(f'   !! {vt} 找不到可拖的 {kind} 卡'); continue
            pg.wait_for_timeout(300)
            pg.evaluate("(id)=>document.querySelector('#team-grid .team-proxy[data-id=\"'+id+'\"]')?.scrollIntoView({block:'nearest'})", cid)
            src = pg.evaluate("(id)=>{const b=document.querySelector('#team-grid .team-proxy[data-id=\"'+id+'\"] .proxy-image').getBoundingClientRect();return {x:b.x+b.width/2,y:b.y+b.height*.88}}", cid)
            slot = pg.evaluate("()=>{const b=document.querySelector('.skill-slot[data-slot=\"1\"]').getBoundingClientRect();return {x:b.x+b.width/2,y:b.y+b.height/2}}")
            pg.mouse.move(src['x'], src['y']); pg.mouse.down()
            pg.mouse.move(src['x'] + 12, src['y'] + 6, steps=3); pg.wait_for_timeout(120)
            sc.shoot(pg, f'drag-{vt}-{kind}-drag-start', freeze=False)
            pg.mouse.move((src['x'] + slot['x']) / 2, (src['y'] + slot['y']) / 2, steps=8); pg.wait_for_timeout(120)
            sc.shoot(pg, f'drag-{vt}-{kind}-drag-mid', freeze=False)
            pg.mouse.move(slot['x'], slot['y'], steps=8); pg.wait_for_timeout(120)
            sc.shoot(pg, f'drag-{vt}-{kind}-drag-over-slot', freeze=False)
            pg.mouse.up()
            pg.evaluate("()=>new Promise(r=>requestAnimationFrame(r))")
            sc.shoot(pg, f'drag-{vt}-{kind}-drop-first-raf', freeze=False)
            pg.wait_for_timeout(400)
            sc.shoot(pg, f'drag-{vt}-{kind}-drop-stable')
            done.append((vt, kind))
        pg.close()
    return done


def negative_control(br, sc, dpr):
    """每個 DPR 至少一個已生效故障控制被檢出。"""
    pg = br.new_page(viewport={'width': 1440, 'height': 4200}, device_scale_factor=dpr)
    pg.goto((HERE / 'cards-remade.html').as_uri()); pg.wait_for_timeout(2000)
    inj = pg.evaluate(INJECT_JS); pg.wait_for_timeout(300)
    rec = sc.shoot(pg, 'negative-control-pool', inject=True, required=False)
    rec['injection'] = inj
    pg.close()
    return rec


def launch(p, channel, gpu):
    if channel:
        args = ['--headless=new', '--ignore-gpu-blocklist'] + ([f'--use-angle={gpu}'] if gpu else [])
        return p.chromium.launch(channel=channel, args=args)
    return p.chromium.launch()


def run_all(out: Path, channel, gpu, dprs):
    fresh(out, 'summary.json')
    summary = {'channel': channel or 'bundled-chromium', 'gpu': gpu, 'dprs': dprs, 'runs': [], 'renderer': None, 'browser': None}
    with sync_playwright() as p:
        br = launch(p, channel, gpu)
        pg = br.new_page(); pg.goto('about:blank')
        summary['renderer'] = pg.evaluate(RENDERER_JS); summary['browser'] = br.version; pg.close()
        sw = 'SwiftShader' in (summary['renderer'] or '')
        if gpu and sw:
            summary['device'] = 'NEEDS_DEVICE: requested GPU but renderer is software'
        print('browser', summary['browser'], 'renderer', summary['renderer'])
        for dpr in dprs:
            sc = Scanner(out, dpr, tag=f'd{dpr:g}-')
            scan_pool(br, sc, dpr); scan_gacha(br, sc, dpr); scan_team(br, sc, dpr)
            drag_done = scan_drag(br, sc, dpr)
            neg = negative_control(br, sc, dpr)
            # 拖曳功能已落地：30 個拖曳狀態無條件必測，整批沒跑（drag API 不在、fixture 全失敗）就是缺口，不能假綠
            has_drag = bool(drag_done)
            required = list(REQUIRED_STATES) + drag_required()
            names = {s['state'] for s in sc.states}
            missing = [s for s in required if s not in names]
            zero_valid = [s['state'] for s in sc.states if s['required'] and s['state'] in required and s['samples'] == 0]
            # 拖曳三個時點（成立／中途／目標上方）：ghost 自己要有 4 個有效角，不拿別的卡充數
            # 每個拖曳畫面 ghost 恰好一張且四角有效；缺記錄的時點由 missing 抓
            ghost_gap = [s['state'] for s in sc.states if s['state'].startswith('drag-') and s['state'].endswith(('-drag-start', '-drag-mid', '-drag-over-slot')) and (s.get('ghost_cards', 0) != 1 or s.get('ghost_valid', 0) < 4)]
            clean_bad = sum(s['bad'] for s in sc.states if not s['inject'])
            run = dict(dpr=dpr, states=sc.states, required=required, missing=missing, zero_valid_required=zero_valid, ghost_gap=ghost_gap,
                       clean_bad=clean_bad, negative_control_bad=neg['bad'], drag_covered=has_drag,
                       ok=(not missing and not zero_valid and not ghost_gap and clean_bad == 0 and neg['bad'] >= 1))
            summary['runs'].append(run)
            print(f"== dpr {dpr}: 狀態 {len(sc.states)} 缺 {len(missing)} 零樣本必測 {len(zero_valid)} ghost缺角 {len(ghost_gap)} 乾淨黑角 {clean_bad} 負控制紅 {neg['bad']} 拖曳{'有' if has_drag else '無'} → {'OK' if run['ok'] else 'FAIL'}")
            if ghost_gap: print('   ghost 缺角:', ghost_gap)
            if missing: print('   缺:', missing)
            if zero_valid: print('   零樣本必測:', zero_valid)
        br.close()
    summary['ok'] = all(r['ok'] for r in summary['runs']) and 'device' not in summary
    (out / 'summary.json').write_text(json.dumps(summary, ensure_ascii=False, indent=1), encoding='utf-8')
    print('>>>', 'PASS' if summary['ok'] else ('NEEDS_DEVICE' if 'device' in summary else 'FAIL'))
    return 0 if summary['ok'] else (3 if 'device' in summary else 1)


# ------------------------------------------------------------------ 自檢
SELF_CSS = """
body{margin:0;background:radial-gradient(circle at 50% 40%,#f3efe2,#c9c2ad 70%)}
.stage{position:absolute;left:200px;top:120px;width:400px;height:560px;perspective:1000px}
.hcard{position:absolute;inset:0;border-radius:12px;background:#151c24;box-shadow:0 14px 30px #0008;overflow:hidden}
.frame{position:absolute;inset:6px;border:5px solid #0b3a4a;border-radius:14px}
.blk{position:absolute;width:12px;height:12px;background:#000}
.blk.TL{left:0;top:0}.blk.TR{right:0;top:0}.blk.BL{left:0;bottom:0}.blk.BR{right:0;bottom:0}
"""


def self_page(blk=None, tilt=False, dialog=False, nocard=False):
    tf = 'transform:rotateY(18deg) rotateX(9deg);transform-style:preserve-3d;' if tilt else ''
    blk_html = f'<div class="blk {blk}"></div>' if blk else ''
    card = '' if nocard else f'<div class="stage" style="{tf}">{blk_html}<div class="hcard"><div class="frame"></div></div></div>'
    dlg = '<dialog open style="position:fixed;inset:0;margin:0;width:100vw;height:100vh;max-width:none;max-height:none;background:#dcd6c4"></dialog>' if dialog else ''
    return f'<!doctype html><meta charset=utf-8><style>{SELF_CSS}</style>{card}{dlg}'


def self_test(out: Path):
    fresh(out, 'selftest.json')
    results = []

    def case(name, html, dpr=1.0, expect_bad=None, expect_status=None, expect_skip_reason=None, expect_note=None):
        with sync_playwright() as p:
            br = p.chromium.launch(); pg = br.new_page(viewport={'width': 900, 'height': 800}, device_scale_factor=dpr)
            pg.set_content(html); pg.wait_for_timeout(200); pg.evaluate(RAF2)
            path = out / f'{name}.png'; pg.screenshot(path=str(path))
            cards = collect_geometry(pg)
            m = measure_corners(Image.open(path), cards, dpr=dpr)
            # 弧外 mask／背景 mask 可視化
            (out / f'{name}.json').write_text(json.dumps(dict(cards=cards, **m), ensure_ascii=False, indent=1), encoding='utf-8')
            br.close()
        bad_corners = sorted({r['corner'] for r in m['rows'] if r['much_darker_pct'] is not None and r['much_darker_pct'] >= 8 and r['darkest'] <= 12})
        ok = True
        if expect_bad is not None: ok &= (bad_corners == sorted(expect_bad))
        if expect_status is not None: ok &= (m['status'] == expect_status)
        if expect_skip_reason is not None: ok &= any(expect_skip_reason in s[1] for s in m['skipped'])
        if expect_note is not None: ok &= any(expect_note in (r.get('note') or '') for r in m['rows'])
        results.append(dict(case=name, dpr=dpr, status=m['status'], bad=bad_corners, samples=m['samples'], skipped=m['skipped'],
                            worst=sorted([r for r in m['rows'] if r['much_darker_pct'] is not None], key=lambda r: -r['much_darker_pct'])[:2], ok=ok))
        print(f"{name:34s} dpr={dpr:<4} status={m['status']:4s} samples={m['samples']} bad={bad_corners} skipped={[s[1] for s in m['skipped']]} → {'OK' if ok else 'FAIL'}")

    # 1. 亮背景 + 深色卡框：誤報 0
    case('clean-bright-dark-frame', self_page(), expect_bad=[], expect_status='PASS')
    case('clean-bright-dark-frame-dpr2', self_page(), dpr=2.0, expect_bad=[], expect_status='PASS')
    # 2. 四個單角黑塊，各自被檢出
    for c in ['TL', 'TR', 'BL', 'BR']:
        case(f'single-corner-{c}', self_page(blk=c), expect_bad=[c])
    case('single-corner-BR-dpr2', self_page(blk='BR'), dpr=2.0, expect_bad=['BR'])
    # 3. 零樣本 → SKIP
    case('zero-sample', self_page(nocard=True), expect_status='SKIP')
    # 4. 遮擋：dialog 蓋住 → 跳過，不判
    case('occluded-by-dialog', self_page(dialog=True), expect_status='SKIP', expect_skip_reason='occluded')
    # 5. 投影幾何：傾斜乾淨 0，傾斜＋單角黑塊檢出
    case('tilted-clean', self_page(tilt=True), expect_bad=[], expect_status='PASS')
    case('tilted-single-TL', self_page(blk='TL', tilt=True), expect_bad=['TL'])
    case('tilted-single-BR-dpr1.5', self_page(blk='BR', tilt=True), dpr=1.5, expect_bad=['BR'])
    # 6. ghost 遮擋：#drag-layer 裡一張黑底 ghost 壓住鄰卡 TR 角 → 該角記 occluded by drag ghost，不得判紅；ghost 自己四角照量
    ghost_html = self_page() + ('<div id="drag-layer" style="position:fixed;inset:0;pointer-events:none">'
                                '<div class="drag-ghost" style="position:absolute;left:560px;top:80px;width:200px;height:280px">'
                                '<div class="hcard" style="background:#000"></div></div></div>')
    case('ghost-occludes-neighbor', ghost_html, expect_bad=[], expect_status='PASS', expect_note='occluded by drag ghost')

    ok = all(r['ok'] for r in results)
    (out / 'selftest.json').write_text(json.dumps(dict(ok=ok, cases=results), ensure_ascii=False, indent=1), encoding='utf-8')
    single = [r for r in results if r['case'].startswith('single-corner-') and not r['case'].endswith('dpr2')]
    print(f"\n>>> 乾淨誤報 {sum(len(r['bad']) for r in results if r['case'].startswith(('clean', 'tilted-clean')))}；"
          f"單角故障檢出 {sum(1 for r in single if r['ok'])}/4；零樣本 SKIP {sum(1 for r in results if r['case'] == 'zero-sample' and r['ok'])}/1；"
          f"總 {sum(1 for r in results if r['ok'])}/{len(results)} → {'PASS' if ok else 'FAIL'}")
    return 0 if ok else 1


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--self-test', action='store_true')
    ap.add_argument('--suite', choices=['all'])
    ap.add_argument('--channel', choices=['chrome', 'msedge'])
    ap.add_argument('--gpu', choices=['d3d11', 'gl'])
    ap.add_argument('--dprs', default='1')
    ap.add_argument('--out', type=Path, required=True)
    a = ap.parse_args()
    out = a.out.resolve()
    if a.self_test:
        return self_test(out)
    if a.suite == 'all':
        return run_all(out, a.channel, a.gpu, [float(x) for x in a.dprs.split(',')])
    ap.error('需要 --self-test 或 --suite all')


if __name__ == '__main__':
    sys.exit(main())

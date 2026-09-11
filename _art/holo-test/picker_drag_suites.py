# -*- coding: utf-8 -*-
"""check_picker_drag.py 的各 suite 實作（ORDER-2026-09-12-picker-drag.md 命令 4／6／8）。

全部以 UI 事件操作（Playwright mouse／keyboard／CDP touch）；fixture 準備可用 team20 公開 API，
正式拖曳不直接呼叫 assignSkill()。所有輸出只寫 out；已存在同名 summary 即報錯。
"""
import json, statistics, subprocess, sys, time
from pathlib import Path
import numpy as np
from PIL import Image
from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE))
from check_card_parity import SAMESIZE_JS, SAMESIZE_RESTORE  # noqa: E402

URL = (HERE / 'map20.html').as_uri()
DESKTOP = [(1440, 900), (1024, 768)]
ALL_VP = [(1440, 900), (1024, 768), (390, 844)]
RAF2 = "()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))"
HOOK = "()=>team20.drag"
# 測試端包 HoloCardFace.observe／unobserve 計數（product 沒有公開 observed 集合）
OBSERVER_WRAP = """()=>{if(window.__obs)return;const o=HoloCardFace.observe,u=HoloCardFace.unobserve;window.__obs=new Set();
  HoloCardFace.observe=f=>{window.__obs.add(f);return o(f)};HoloCardFace.unobserve=f=>{window.__obs.delete(f);return u(f)}}"""
PICKER_FACES = """()=>[...document.querySelectorAll('#picker-grid .team-proxy')].map(b=>{const m=b.querySelector('.overview-face');const h=m&&m.shadowRoot&&m.shadowRoot.querySelectorAll('.hcard').length;return {id:b.dataset.id,faces:h||0,imgs:b.querySelectorAll('img').length}})"""


class Suite:
    def __init__(self, out: Path, name):
        self.out, self.name = out, name
        out.mkdir(parents=True, exist_ok=True)
        if (out / 'summary.json').exists():
            raise SystemExit(f'!! 既有證據不可覆寫：{out / "summary.json"}')
        self.checks = []

    def check(self, name, value, low, high=None, note=''):
        high = low if high is None else high
        ok = (low <= value <= high) if isinstance(value, (int, float)) else (value == low)
        self.checks.append(dict(name=name, value=value, expect=[low, high], ok=bool(ok), note=note))
        if not ok:
            print(f'  FAIL {name}: {value} (expect {low}..{high}) {note}')
        return ok

    def finish(self, extra=None):
        fails = [c for c in self.checks if not c['ok']]
        summary = dict(suite=self.name, checks=len(self.checks), failed=len(fails), fails=fails, ok=not fails, **(extra or {}))
        (self.out / 'summary.json').write_text(json.dumps(dict(summary, all=self.checks), ensure_ascii=False, indent=1), encoding='utf-8')
        print(f">>> {self.name}: {len(self.checks) - len(fails)}/{len(self.checks)} 斷言通過 → {'PASS' if not fails else 'FAIL'}")
        return 0 if not fails else 1


def launch(p, channel=None):
    if channel:
        return p.chromium.launch(channel=channel, args=['--headless=new', '--use-angle=d3d11', '--ignore-gpu-blocklist'])
    return p.chromium.launch()


def open_team(br, vw, vh, dpr=1, touch=False):
    ctx = br.new_context(viewport={'width': vw, 'height': vh}, device_scale_factor=dpr, has_touch=touch)
    pg = ctx.new_page()
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
    pg.on('console', lambda m: errs.append('console.error: ' + m.text[:160]) if m.type == 'error' else None)
    pg.goto(URL); pg.wait_for_timeout(900)
    pg.evaluate(OBSERVER_WRAP)
    pg.click('#open-team'); pg.wait_for_timeout(900)
    pg.errs = errs
    return pg


def center(pg, selector):
    return pg.evaluate("(s)=>{const e=document.querySelector(s);if(!e)return null;const b=e.getBoundingClientRect();return {x:b.x+b.width/2,y:b.y+b.height/2,w:b.width,h:b.height}}", selector)


def drag(pg, src_sel, dst_sel=None, dst_xy=None, steps=8, hold=False):
    # 來源在 .roster-scroll 裡可能被截掉（1024×768 第二頁下排），像使用者一樣先捲到看得到
    pg.evaluate("(s)=>document.querySelector(s)?.scrollIntoView({block:'nearest'})", src_sel)
    s = center(pg, src_sel); d = dst_xy or center(pg, dst_sel)
    pg.mouse.move(s['x'], s['y']); pg.mouse.down()
    pg.mouse.move(s['x'] + 12, s['y'] + 6, steps=2)
    pg.mouse.move(d['x'], d['y'], steps=steps); pg.wait_for_timeout(60)
    pg.evaluate(RAF2)
    if not hold:
        pg.mouse.up(); pg.wait_for_timeout(40)
    return s, d


def clean_state(pg, S, tag):
    h = pg.evaluate(HOOK)
    S.check(f'{tag}.ghosts', h['ghosts'], 0); S.check(f'{tag}.targets', h['targets'], 0)
    S.check(f'{tag}.rafPending', h['rafPending'], False); S.check(f'{tag}.pending', h['pending'], False)


# ------------------------------------------------------------------ picker
def suite_picker(out, channel):
    S = Suite(out, 'picker')
    with sync_playwright() as p:
        br = launch(p, channel)
        for vw, vh in ALL_VP:
            pg = open_team(br, vw, vh); tag = f'{vw}x{vh}'
            # 總覽兩頁聯集 20
            ids = set()
            for page in (0, 1):
                pg.evaluate("(n)=>team20.showPage(n)", page); pg.wait_for_timeout(300)
                vis = pg.evaluate("()=>[...document.querySelectorAll('#team-grid .team-proxy:not([hidden])')].map(b=>b.dataset.id)")
                faces = pg.evaluate("()=>[...document.querySelectorAll('#team-grid .team-proxy:not([hidden]) .overview-face')].filter(m=>m.shadowRoot&&m.shadowRoot.querySelector('.hcard')).length")
                S.check(f'{tag}.overview.page{page}.visible', len(vis), 10); S.check(f'{tag}.overview.page{page}.faces', faces, 10)
                ids |= set(vis)
            S.check(f'{tag}.overview.union', len(ids), 20)
            pg.evaluate("()=>team20.showPage(0)")
            for mode in ['skill', 'add', 'replace']:
                pg.evaluate("(m)=>team20.openPicker(m,1)", mode); pg.wait_for_timeout(500); pg.evaluate(RAF2)
                rows = pg.evaluate(PICKER_FACES)
                S.check(f'{tag}.{mode}.buttons', len(rows), 24)
                S.check(f'{tag}.{mode}.one_face_each', sum(1 for r in rows if r['faces'] == 1), 24)
                S.check(f'{tag}.{mode}.leftover_imgs', sum(r['imgs'] for r in rows), 0)
                # 逐列捲動：每一格 scrollIntoView 後要落在 picker-grid 可視範圍內
                reach = pg.evaluate("""()=>{const g=document.querySelector('#picker-grid');const gr=g.getBoundingClientRect();let n=0;
                  for(const b of g.querySelectorAll('.team-proxy')){b.scrollIntoView({block:'nearest'});const r=b.getBoundingClientRect();
                    if(r.top>=gr.top-1&&r.bottom<=gr.bottom+1&&r.width>0)n++}g.scrollTop=0;return n}""")
                S.check(f'{tag}.{mode}.reachable', reach, 24)
                if mode == 'skill':
                    pg.screenshot(path=str(out / f'{tag}-picker-{mode}.png'))
                # 關閉路徑：skill 用 Escape、add 用關閉鍵、replace 用確認成功（選一張同稀有度的候選）
                if mode == 'skill':
                    pg.keyboard.press('Escape')
                elif mode == 'add':
                    pg.click('#picker-close')
                else:
                    ok = pg.evaluate("""()=>{const sel=team20.roster[0];const r=team20.cards.find(c=>c.id===sel).rarity;
                      const cand=[...document.querySelectorAll('#picker-grid .team-proxy:not([disabled])')].find(b=>team20.cards.find(c=>c.id===b.dataset.id).rarity===r);
                      if(!cand)return 'none';cand.click();return 'clicked'}""")
                    pg.wait_for_timeout(250)
                    if ok == 'clicked':
                        pg.click('#picker-confirm')
                    else:
                        pg.click('#picker-close')
                pg.wait_for_timeout(250)
                S.check(f'{tag}.{mode}.closed', pg.evaluate("()=>document.querySelector('#team-picker').open"), False)
                S.check(f'{tag}.{mode}.picker_faces_after_close', pg.evaluate("()=>team20.drag.pickerFaces"), 0)
                S.check(f'{tag}.{mode}.picker_dom_after_close', pg.evaluate("()=>document.querySelectorAll('#picker-grid .overview-face').length"), 0)
                pg.evaluate("()=>team20.reset()"); pg.wait_for_timeout(200)
            # 開關 20 次
            base_obs = pg.evaluate("()=>window.__obs.size")
            for i in range(20):
                pg.evaluate("()=>team20.openPicker('skill',0)"); pg.wait_for_timeout(120)
                pg.keyboard.press('Escape'); pg.wait_for_timeout(60)
            after = pg.evaluate("()=>({obs:window.__obs.size,pf:team20.drag.pickerFaces,dom:document.querySelectorAll('#picker-grid .overview-face').length,ov:team20.drag.overviewFaces,hcards:[...document.querySelectorAll('#team-grid .overview-face')].filter(m=>m.shadowRoot&&m.shadowRoot.querySelector('.hcard')).length})")
            S.check(f'{tag}.cycle20.observers_delta', after['obs'] - base_obs, 0)
            S.check(f'{tag}.cycle20.picker_faces', after['pf'], 0); S.check(f'{tag}.cycle20.picker_dom', after['dom'], 0)
            S.check(f'{tag}.cycle20.overview_faces', after['ov'], 10); S.check(f'{tag}.cycle20.overview_hcards', after['hcards'], 10)
            # 切畫面清理
            pg.evaluate("()=>team20.openPicker('skill',0)"); pg.wait_for_timeout(200)
            pg.evaluate("()=>team20.setScreen('map')"); pg.wait_for_timeout(200)
            S.check(f'{tag}.setScreen.picker_closed', pg.evaluate("()=>document.querySelector('#team-picker').open"), False)
            S.check(f'{tag}.setScreen.picker_faces', pg.evaluate("()=>team20.drag.pickerFaces"), 0)
            S.check(f'{tag}.errors', len(pg.errs), 0, note=str(pg.errs[:3]))
            pg.close()
        br.close()
    return S.finish()


# ------------------------------------------------------------------ drag
def suite_drag(out, channel):
    S = Suite(out, 'drag')
    with sync_playwright() as p:
        br = launch(p, channel)
        total_ok = 0; total = 0
        for vw, vh in DESKTOP:
            pg = open_team(br, vw, vh); tag = f'{vw}x{vh}'
            roster = pg.evaluate("()=>team20.roster")
            S.check(f'{tag}.roster', len(roster), 20)
            labels = pg.evaluate("()=>[...document.querySelectorAll('.skill-slot')].map(b=>[b.dataset.slot,b.querySelector('small').textContent])")
            for k in range(4):
                S.check(f'{tag}.slot{k}.label_matches_data_slot', labels[k][0] == str(k) and labels[k][1] == f'獨立技能 {k + 1}', True, note=str(labels[k]))
            for mi, mid in enumerate(roster):
                for k in range(4):
                    total += 1
                    pg.evaluate("()=>team20.reset()"); pg.evaluate("(n)=>team20.showPage(n)", mi // 10); pg.wait_for_timeout(120)
                    before = pg.evaluate("()=>({r:team20.roster,s:team20.skills})")
                    drag(pg, f'#team-grid .team-proxy[data-id="{mid}"]', f'.skill-slot[data-slot="{k}"]')
                    after = pg.evaluate("()=>({r:team20.roster,s:team20.skills})")
                    exp = [None] * 4; exp[k] = mid
                    good = after['s'] == exp and after['r'] == before['r']
                    total_ok += good
                    if not good:
                        S.check(f'{tag}.assign.{mid}.slot{k}', json.dumps(after['s']), json.dumps(exp))
                    h = pg.evaluate(HOOK)
                    if h['ghosts'] or h['targets'] or h['rafPending'] or h['pending']:
                        S.check(f'{tag}.assign.{mid}.slot{k}.clean', json.dumps(h), 'clean')
            pg.evaluate("()=>team20.reset()"); pg.evaluate("()=>team20.showPage(0)"); pg.wait_for_timeout(150)
            first = pg.evaluate("()=>team20.roster[2]")
            sel = f'#team-grid .team-proxy[data-id="{first}"]'
            # 未達 8px：算點擊（開詳情），技能不變
            s = center(pg, sel); pg.mouse.move(s['x'], s['y']); pg.mouse.down(); pg.mouse.move(s['x'] + 5, s['y'] + 3, steps=2); pg.mouse.up(); pg.wait_for_timeout(150)
            S.check(f'{tag}.under8.detail_open', pg.evaluate("()=>document.querySelector('#team-screen').classList.contains('detail-open')"), True)
            S.check(f'{tag}.under8.selected', pg.evaluate("()=>document.querySelector('#team-detail').dataset.id"), first)
            S.check(f'{tag}.under8.skills', json.dumps(pg.evaluate("()=>team20.skills")), json.dumps([None] * 4))
            pg.evaluate("()=>document.querySelector('#team-screen').classList.remove('detail-open')")
            # 剛達 8px：拖曳成立（ghost 1）
            pg.mouse.move(s['x'], s['y']); pg.mouse.down(); pg.mouse.move(s['x'] + 8, s['y'], steps=1); pg.wait_for_timeout(60)
            h = pg.evaluate(HOOK); S.check(f'{tag}.at8.active', h['active'], True); S.check(f'{tag}.at8.ghost', h['ghosts'], 1)
            # 非目標放下：取消、訊息、無變更
            pg.mouse.move(s['x'] + 80, s['y'] + 120, steps=4); pg.mouse.up(); pg.wait_for_timeout(100)
            S.check(f'{tag}.nontarget.skills', json.dumps(pg.evaluate("()=>team20.skills")), json.dumps([None] * 4))
            S.check(f'{tag}.nontarget.message', pg.evaluate("()=>document.querySelector('#skill-status').textContent"), '已取消，技能未變更')
            S.check(f'{tag}.nontarget.detail_not_opened', pg.evaluate("()=>document.querySelector('#team-screen').classList.contains('detail-open')"), False)
            clean_state(pg, S, f'{tag}.nontarget')
            # 拖曳後下一次普通 click 恢復：只觸發一次選取
            pg.mouse.click(s['x'], s['y']); pg.wait_for_timeout(150)
            S.check(f'{tag}.nextclick.detail_open', pg.evaluate("()=>document.querySelector('#team-screen').classList.contains('detail-open')"), True)
            pg.evaluate("()=>document.querySelector('#team-screen').classList.remove('detail-open')")
            # Escape／pointercancel／換頭／開挑選器／切畫面 各自清理
            drag(pg, sel, dst_xy={'x': s['x'] + 90, 'y': s['y'] + 90}, hold=True); pg.keyboard.press('Escape'); pg.mouse.up(); pg.wait_for_timeout(80)
            clean_state(pg, S, f'{tag}.escape')
            drag(pg, sel, dst_xy={'x': s['x'] + 90, 'y': s['y'] + 90}, hold=True); pg.evaluate("()=>team20.showPage(1)"); pg.mouse.up(); pg.wait_for_timeout(80)
            clean_state(pg, S, f'{tag}.showPage'); pg.evaluate("()=>team20.showPage(0)")
            drag(pg, sel, dst_xy={'x': s['x'] + 90, 'y': s['y'] + 90}, hold=True); pg.evaluate("()=>team20.openPicker('skill',0)"); pg.mouse.up(); pg.wait_for_timeout(80)
            clean_state(pg, S, f'{tag}.openPicker'); pg.keyboard.press('Escape'); pg.wait_for_timeout(80)
            drag(pg, sel, dst_xy={'x': s['x'] + 90, 'y': s['y'] + 90}, hold=True); pg.evaluate("()=>team20.setScreen('map')"); pg.mouse.up(); pg.wait_for_timeout(80)
            clean_state(pg, S, f'{tag}.setScreen'); pg.evaluate("()=>team20.setScreen('team')"); pg.wait_for_timeout(300)
            drag(pg, sel, dst_xy={'x': s['x'] + 90, 'y': s['y'] + 90}, hold=True); pg.evaluate("()=>dispatchEvent(new Event('blur'))"); pg.mouse.up(); pg.wait_for_timeout(80)
            clean_state(pg, S, f'{tag}.blur')
            drag(pg, sel, dst_xy={'x': s['x'] + 90, 'y': s['y'] + 90}, hold=True)
            pg.evaluate("()=>{const b=document.querySelector('#team-grid .team-proxy.drag-source');b.dispatchEvent(new PointerEvent('pointercancel',{pointerId:1,bubbles:true}))}"); pg.mouse.up(); pg.wait_for_timeout(80)
            clean_state(pg, S, f'{tag}.pointercancel')
            S.check(f'{tag}.roster_unchanged', json.dumps(pg.evaluate("()=>team20.roster")), json.dumps(roster))
            # 神話：第一張成功、第二格再放神話拒絕（訊息可見）、同格替換神話成功
            pg.evaluate("()=>team20.reset()"); pg.evaluate("()=>team20.showPage(0)"); pg.wait_for_timeout(120)
            myth = pg.evaluate("()=>team20.roster.filter(id=>team20.cards.find(c=>c.id===id).rarity==='mythic')")
            S.check(f'{tag}.mythic.available', len(myth), 2, 99)
            drag(pg, f'#team-grid .team-proxy[data-id="{myth[0]}"]', '.skill-slot[data-slot="0"]')
            S.check(f'{tag}.mythic.first', pg.evaluate("()=>team20.skills[0]"), myth[0])
            drag(pg, f'#team-grid .team-proxy[data-id="{myth[1]}"]', '.skill-slot[data-slot="1"]')
            S.check(f'{tag}.mythic.second_rejected', pg.evaluate("()=>team20.skills[1]"), None)
            msg = pg.evaluate("()=>{const e=document.querySelector('#skill-status');const r=e.getBoundingClientRect();const s=getComputedStyle(e);return {text:e.textContent,visible:r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none'&&!document.querySelector('#team-picker').open}}")
            S.check(f'{tag}.mythic.reject_message_visible', msg['visible'] and msg['text'].startswith('神話技能最多 1 張'), True, note=msg['text'])
            drag(pg, f'#team-grid .team-proxy[data-id="{myth[1]}"]', '.skill-slot[data-slot="0"]')
            S.check(f'{tag}.mythic.replace_same_slot', pg.evaluate("()=>team20.skills[0]"), myth[1])
            # 拖曳中的選區：真拖曳時 selection 為空，且「清掉選區前後」網格 ROI 像素差 0（差分判定，不是數藍像素）
            pg.evaluate("()=>team20.reset()"); pg.wait_for_timeout(120)
            drag(pg, sel, '.skill-slot[data-slot="2"]', hold=True)
            grid = pg.evaluate("()=>{const b=document.querySelector('#team-grid').getBoundingClientRect();return {x:Math.max(0,b.x),y:Math.max(0,b.y),width:Math.min(b.width,innerWidth-Math.max(0,b.x)),height:Math.min(b.height,innerHeight-Math.max(0,b.y))}}")
            selinfo = pg.evaluate("()=>{const s=getSelection();return {text:s.toString(),collapsed:s.isCollapsed,ranges:s.rangeCount}}")
            a = out / f'{tag}-drag-selection-on.png'; b = out / f'{tag}-drag-selection-off.png'
            pg.screenshot(path=str(a), clip=grid); pg.evaluate("()=>getSelection().removeAllRanges()"); pg.evaluate(RAF2); pg.screenshot(path=str(b), clip=grid)
            diff = np.abs(np.asarray(Image.open(a).convert('RGB'), int) - np.asarray(Image.open(b).convert('RGB'), int)).max(axis=2)
            S.check(f'{tag}.selection.text_empty', selinfo['text'], ''); S.check(f'{tag}.selection.roi_diff_fraction', float((diff > 32).mean()), 0.0, 0.001)
            pg.screenshot(path=str(out / f'{tag}-drag-over-slot.png'))
            pg.mouse.up(); pg.wait_for_timeout(100)
            S.check(f'{tag}.selection.assigned', pg.evaluate("()=>team20.skills[2]"), first)
            S.check(f'{tag}.errors', len(pg.errs), 0, note=str(pg.errs[:3]))
            pg.close()
        S.check('desktop.assign.correct', total_ok, 160); S.check('desktop.assign.total', total, 160)
        # 手機：點技能格開窗 4/4；touch 拖曳／捲動不改技能
        pg = open_team(br, 390, 844, touch=True)
        opened = 0
        for k in range(4):
            pg.evaluate("(k)=>document.querySelector(`.skill-slot[data-slot=\"${k}\"]`).scrollIntoView({block:'center'})", k); pg.wait_for_timeout(100)
            c = center(pg, f'.skill-slot[data-slot="{k}"]'); pg.touchscreen.tap(c['x'], c['y']); pg.wait_for_timeout(300)
            opened += pg.evaluate("()=>document.querySelector('#team-picker').open&&document.querySelector('#picker-title').textContent==='挑選獨立技能'")
            pg.keyboard.press('Escape'); pg.wait_for_timeout(120)
        S.check('phone.tap_slot_opens_picker', opened, 4)
        pg.evaluate("()=>document.querySelector('#team-grid').scrollIntoView({block:'start'})"); pg.wait_for_timeout(100)
        src = center(pg, '#team-grid .team-proxy:not([hidden])')
        cdp = pg.context.new_cdp_session(pg)
        pts = lambda x, y: [{'x': x, 'y': y, 'radiusX': 4, 'radiusY': 4, 'force': 1, 'id': 1}]
        cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': pts(src['x'], src['y'])})
        for i in range(1, 9):
            cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': pts(src['x'], src['y'] - i * 30)})
        cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []}); pg.wait_for_timeout(200)
        S.check('phone.touch_drag_skills_unchanged', json.dumps(pg.evaluate("()=>team20.skills")), json.dumps([None] * 4))
        clean_state(pg, S, 'phone.touch')
        S.check('phone.errors', len(pg.errs), 0, note=str(pg.errs[:3]))
        pg.close(); br.close()
    return S.finish(dict(desktop_assign_ok=total_ok, desktop_assign_total=total))


# ------------------------------------------------------------------ pixels
ISOLATE_ONE = """(which)=>{ // which: 'picker' | 'overview' —— 全頁只顯示該入口裡 window.__pid 那張卡（沿用 parity 的 ISOLATE 做法）
  const roots=new Set();(function w(r){roots.add(r);r.querySelectorAll('*').forEach(e=>{if(e.shadowRoot)w(e.shadowRoot)})})(document);
  roots.forEach(r=>{if(!r.querySelector('.__iso')){const s=document.createElement('style');s.className='__iso';
    s.textContent='*{visibility:hidden !important} .hcard[data-shot],.hcard[data-shot] *{visibility:visible !important} #team-picker::backdrop{display:none !important}';(r.head||r).appendChild(s)}});
  document.documentElement.style.background='#0e121a';document.body.style.background='#0e121a';
  const cs=[];roots.forEach(r=>r.querySelectorAll('.hcard').forEach(c=>cs.push(c)));
  const within=(c,id)=>{let p=c;while(p){if(p.id===id)return true;p=p.parentElement||(p.getRootNode().host||null)}return false};
  cs.forEach(c=>{delete c.dataset.shot});
  const target=cs.find(c=>c.dataset.id===window.__pid&&within(c,which==='picker'?'picker-grid':'team-grid'));
  if(!target)return null;target.dataset.shot='';
  let e=target.parentElement||target.getRootNode().host;while(e){e.style.setProperty('overflow','visible','important');e=e.parentElement||(e.getRootNode().host||null)}
  getSelection().removeAllRanges();
  const r=target.getBoundingClientRect();
  const q=s=>{const el=target.querySelector(s);if(!el)return null;const b=el.getBoundingClientRect();const cs=getComputedStyle(el);return {x:b.x-r.x,y:b.y-r.y,w:b.width,h:b.height,font:cs.fontFamily,size:cs.fontSize,weight:cs.fontWeight,color:cs.color,fill:cs.webkitTextFillColor,bgi:cs.backgroundImage.slice(0,60)}};
  return {x:r.x,y:r.y,w:r.width,h:r.height,name:q('.face-name'),rarity:q('.face-rarity'),plate:q('.face-plate'),gem:q('.face-gem'),
    fontsOk:document.fonts.check('12px "Holo Noto Sans"')};}"""


def suite_pixels(out, channel):
    S = Suite(out, 'pixels'); W = 260; DPR = 2
    with sync_playwright() as p:
        br = launch(p, channel)
        cards_all = None
        for vw, vh in ALL_VP:
            pg = open_team(br, vw, vh, dpr=DPR); tag = f'{vw}x{vh}'
            pg.wait_for_function("()=>document.fonts.status==='loaded'", timeout=15000)
            cards_all = cards_all or pg.evaluate("()=>team20.cards.map(c=>({id:c.id,rarity:c.rarity}))")
            roster = pg.evaluate("()=>team20.roster")
            for c in cards_all:
                cid = c['id']
                pg.evaluate("()=>team20.reset()")
                if cid not in roster:
                    # 不在 roster 的四張：以同稀有度成員換入（fixture 用公開 API，不縮小預期集合）
                    how = pg.evaluate("""(id)=>{const t=team20;const c=t.cards.find(x=>x.id===id);const same=t.roster.find(r=>t.cards.find(y=>y.id===r).rarity===c.rarity);if(!same)return 'no-slot';return t.add(id,same)?'ok':'rejected'}""", cid)
                    S.check(f'{tag}.{cid}.fixture', how, 'ok')
                idx = pg.evaluate("(id)=>team20.roster.indexOf(id)", cid)
                pg.evaluate("(n)=>team20.showPage(n)", max(0, idx // 10))
                pg.evaluate("()=>team20.openPicker('skill',0)"); pg.wait_for_timeout(250); pg.evaluate(RAF2)
                pg.evaluate("(id)=>{window.__pid=id}", cid)
                # 同尺寸中性姿態（沿用 parity 的 SAMESIZE），全部卡 fixed 到 (40,40)
                pg.evaluate("()=>[document,...[...document.querySelectorAll('*')].filter(e=>e.shadowRoot).map(e=>e.shadowRoot)].forEach(r=>r.getAnimations().forEach(a=>{try{a.pause();a.currentTime=0}catch{}}))")
                pg.evaluate(SAMESIZE_JS, W)
                pg.evaluate("()=>Promise.all([...document.querySelectorAll('img')].map(i=>i.decode().catch(()=>0)))")
                shots = {}; metas = {}
                for which in ['picker', 'overview']:
                    meta = pg.evaluate(ISOLATE_ONE, which)
                    if not meta:
                        S.check(f'{tag}.{cid}.{which}.found', 0, 1); continue
                    metas[which] = meta
                    pg.evaluate("()=>document.getSelection().removeAllRanges()")
                    runs = []
                    for r in range(3):
                        pg.evaluate(RAF2)
                        path = out / f'{tag}-{cid}-{which}-{r}.png'
                        pg.screenshot(path=str(path), clip={'x': 40, 'y': 40, 'width': W, 'height': W * 7 / 5})
                        runs.append(np.asarray(Image.open(path).convert('RGB'), int))
                    rep = max(float(np.abs(runs[i] - runs[j]).max(axis=2).mean()) for i in range(3) for j in range(i + 1, 3))
                    S.check(f'{tag}.{cid}.{which}.repro_mean', rep, 0.0, 1.0)
                    shots[which] = runs[0]
                pg.evaluate(SAMESIZE_RESTORE); pg.evaluate("()=>{const roots=new Set();(function w(r){roots.add(r);r.querySelectorAll('*').forEach(e=>{if(e.shadowRoot)w(e.shadowRoot)})})(document);roots.forEach(r=>r.querySelectorAll('.__iso').forEach(s=>s.remove()));document.documentElement.style.background='';document.body.style.background=''}")
                pg.keyboard.press('Escape'); pg.wait_for_timeout(120)
                if len(shots) == 2:
                    a, b = shots['picker'], shots['overview']
                    S.check(f'{tag}.{cid}.shape', a.shape == b.shape, True)
                    if a.shape == b.shape:
                        d = np.abs(a - b).max(axis=2)
                        S.check(f'{tag}.{cid}.mean', float(d.mean()), 0.0, 1.0)
                        S.check(f'{tag}.{cid}.over32', float((d > 32).mean()), 0.0, 0.01)
                        S.check(f'{tag}.{cid}.lum_std', float(np.asarray(Image.fromarray(a.astype('uint8')).convert('L')).std()), 8.0001, 1e9)
                        for roi in ['name', 'rarity']:
                            m = metas['picker'][roi]
                            if m and m['w'] > 0:
                                x0, y0 = int(m['x'] * DPR), int(m['y'] * DPR); x1, y1 = int((m['x'] + m['w']) * DPR), int((m['y'] + m['h']) * DPR)
                                dd = d[max(0, y0):y1, max(0, x0):x1]
                                S.check(f'{tag}.{cid}.{roi}.roi_nonempty', dd.size > 0, True)
                                if dd.size:
                                    S.check(f'{tag}.{cid}.{roi}.mean', float(dd.mean()), 0.0, 1.0); S.check(f'{tag}.{cid}.{roi}.over32', float((dd > 32).mean()), 0.0, 0.01)
                            else:
                                S.check(f'{tag}.{cid}.{roi}.roi_nonempty', False, True)
                    # 幾何契約 0.011px、字型不落 fallback、階級墨色一致
                    for key in ['name', 'rarity', 'plate', 'gem']:
                        mp, mo = metas['picker'].get(key), metas['overview'].get(key)
                        if mp and mo:
                            geo = max(abs(mp[k] - mo[k]) for k in ('x', 'y', 'w', 'h'))
                            S.check(f'{tag}.{cid}.{key}.geometry', geo, 0.0, 0.011)
                            if key in ('name', 'rarity'):
                                S.check(f'{tag}.{cid}.{key}.font_same', mp['font'] == mo['font'] and mp['size'] == mo['size'] and mp['weight'] == mo['weight'], True, note=f"{mp['font'][:40]} vs {mo['font'][:40]}")
                                S.check(f'{tag}.{cid}.{key}.ink_same', mp['color'] == mo['color'] and mp['fill'] == mo['fill'] and mp['bgi'] == mo['bgi'], True, note=f"{mp['color']} vs {mo['color']}")
                                S.check(f'{tag}.{cid}.{key}.no_fallback', 'Holo Noto' in mp['font'] and metas['picker']['fontsOk'], True, note=mp['font'][:60])
            S.check(f'{tag}.errors', len(pg.errs), 0, note=str(pg.errs[:3]))
            pg.close()
        br.close()
    return S.finish()


# ------------------------------------------------------------------ negative
def suite_negative(out, channel):
    """四類反例各自被相關斷言拒絕（子案例 exit 1）；乾淨組 FAIL 0。"""
    S = Suite(out, 'negative')
    faults = {
        'fewer-cards': dict(css="#picker-grid .team-proxy:nth-child(24){display:none!important}", suite='picker'),
        'wrong-rank-ink': dict(shadow_css=".hcard b.face-name{color:#b875ff!important;-webkit-text-fill-color:#b875ff!important;background-image:none!important}", suite='pixels', scope='picker'),
        'wrong-slot': dict(js="()=>{[...document.querySelectorAll('.skill-slot')].forEach((b,i)=>{b.dataset.slot=String((i+1)%4)})}", suite='drag'),
        'real-selection': dict(js="()=>{const st=document.createElement('style');st.textContent='#team-grid,#team-grid *{user-select:text!important;-webkit-user-select:text!important}';document.head.append(st);[...document.querySelectorAll('#team-grid .overview-face')].forEach(m=>{const s=document.createElement('style');s.textContent='.hcard,.hcard *{user-select:text!important;-webkit-user-select:text!important}';m.shadowRoot.append(s)});getSelection().selectAllChildren(document.querySelector('#team-grid'))}", suite='drag'),
    }
    results = {}
    for name, f in faults.items():
        sub = out / name; sub.mkdir(parents=True, exist_ok=True)
        rc = run_faulted(f, sub, channel)
        results[name] = rc
        S.check(f'negative.{name}.rejected', rc, 1, note='子案例必須 exit 1')
    return S.finish(dict(results=results))


def run_faulted(f, sub, channel):
    """在頁面載入後注入故障，再跑對應 suite 的最小子集；回傳 0＝沒被抓到（壞）、1＝被拒（好）。"""
    S = Suite(sub, 'negative-sub')
    with sync_playwright() as p:
        br = launch(p, channel)
        pg = open_team(br, 1440, 900, dpr=2 if f['suite'] == 'pixels' else 1)
        if f.get('css'):
            pg.add_style_tag(content=f['css'])
        if f.get('js') and f['suite'] != 'drag':
            pg.evaluate(f['js'])
        if f['suite'] == 'picker':
            pg.evaluate("()=>team20.openPicker('skill',0)"); pg.wait_for_timeout(400)
            rows = pg.evaluate(PICKER_FACES)
            visible = pg.evaluate("()=>[...document.querySelectorAll('#picker-grid .team-proxy')].filter(b=>b.getBoundingClientRect().width>0).length")
            S.check('picker.visible_buttons', visible, 24); S.check('picker.one_face_each', sum(1 for r in rows if r['faces'] == 1), 24)
        elif f['suite'] == 'pixels':
            cid = pg.evaluate("()=>team20.roster.find(id=>team20.cards.find(c=>c.id===id).rarity==='epic')")
            pg.evaluate("()=>team20.openPicker('skill',0)"); pg.wait_for_timeout(300)
            pg.evaluate("(css)=>[...document.querySelectorAll('#picker-grid .overview-face')].forEach(m=>{const s=document.createElement('style');s.textContent=css;m.shadowRoot.append(s)})", f['shadow_css'])
            pg.evaluate("(id)=>{window.__pid=id}", cid); pg.evaluate(SAMESIZE_JS, 260)
            shots = {}; metas = {}
            for which in ['picker', 'overview']:
                metas[which] = pg.evaluate(ISOLATE_ONE, which); pg.evaluate(RAF2)
                path = sub / f'{which}.png'; pg.screenshot(path=str(path), clip={'x': 40, 'y': 40, 'width': 260, 'height': 364}); shots[which] = np.asarray(Image.open(path).convert('RGB'), int)
            d = np.abs(shots['picker'] - shots['overview']).max(axis=2); m = metas['picker']['name']
            dd = d[int(m['y'] * 2):int((m['y'] + m['h']) * 2), int(m['x'] * 2):int((m['x'] + m['w']) * 2)]
            S.check('pixels.name.mean', float(dd.mean()), 0.0, 1.0); S.check('pixels.name.over32', float((dd > 32).mean()), 0.0, 0.01)
            S.check('pixels.name.ink_same', metas['picker']['name']['color'] == metas['overview']['name']['color'], True)
        elif f['suite'] == 'drag':
            first = pg.evaluate("()=>team20.roster[2]"); sel = f'#team-grid .team-proxy[data-id="{first}"]'
            if 'selectAllChildren' in f['js']:
                drag(pg, sel, '.skill-slot[data-slot="2"]', hold=True)
                pg.evaluate(f['js']); pg.evaluate(RAF2)
                grid = pg.evaluate("()=>{const b=document.querySelector('#team-grid').getBoundingClientRect();return {x:Math.max(0,b.x),y:Math.max(0,b.y),width:Math.min(b.width,innerWidth-Math.max(0,b.x)),height:Math.min(b.height,innerHeight-Math.max(0,b.y))}}")
                a = sub / 'selection-on.png'; b = sub / 'selection-off.png'
                pg.screenshot(path=str(a), clip=grid); pg.evaluate("()=>getSelection().removeAllRanges()"); pg.evaluate(RAF2); pg.screenshot(path=str(b), clip=grid)
                diff = np.abs(np.asarray(Image.open(a).convert('RGB'), int) - np.asarray(Image.open(b).convert('RGB'), int)).max(axis=2)
                S.check('selection.roi_diff_fraction', float((diff > 32).mean()), 0.0, 0.001, note='真實選區覆色必須被差分抓到')
                pg.mouse.up()
            else:
                pg.evaluate(f['js'])
                # 目標用使用者看得到的標籤選（「獨立技能 2」），不是 data-slot
                dst = pg.evaluate("()=>{const b=[...document.querySelectorAll('.skill-slot')].find(x=>x.textContent.includes('獨立技能 2'));const r=b.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}}")
                drag(pg, sel, dst_xy=dst)
                S.check('drag.label2_assigns_index1', pg.evaluate("()=>team20.skills[1]"), first)
                S.check('drag.others_none', json.dumps([pg.evaluate("()=>team20.skills")[i] for i in (0, 2, 3)]), json.dumps([None] * 3))
        pg.close(); br.close()
    return S.finish()


# ------------------------------------------------------------------ perf
PERF_JS = """()=>{window.__perf={frames:[],on:false,ghostWrites:0,mo:null,raf:0,
  start(){cancelAnimationFrame(this.raf);this.frames=[];this.on=true;this.ghostWrites=0;const g=document.querySelector('#drag-layer .drag-ghost');if(g){this.mo=new MutationObserver(m=>{this.ghostWrites+=m.length});this.mo.observe(g,{attributes:true,attributeFilter:['style']})}
    const step=t=>{if(!this.on)return;this.frames.push(t);this.raf=requestAnimationFrame(step)};this.raf=requestAnimationFrame(step)},
  stop(){this.on=false;cancelAnimationFrame(this.raf);this.raf=0;this.mo?.disconnect();const f=this.frames;const iv=[];for(let i=1;i<f.length;i++)iv.push(f[i]-f[i-1]);return {intervals:iv,ghostWrites:this.ghostWrites}}}}"""


def suite_perf(out, channel):
    S = Suite(out, 'perf')
    with sync_playwright() as p:
        br = launch(p, channel or 'chrome')
        renderer = None
        for vw, vh in DESKTOP:
            pg = open_team(br, vw, vh, dpr=1.25); tag = f'{vw}x{vh}@1.25'
            renderer = renderer or pg.evaluate("()=>{const gl=document.createElement('canvas').getContext('webgl');const e=gl.getExtension('WEBGL_debug_renderer_info');return gl.getParameter(e.UNMASKED_RENDERER_WEBGL)}")
            pg.evaluate(PERF_JS)
            first = pg.evaluate("()=>team20.roster[3]"); sel = f'#team-grid .team-proxy[data-id="{first}"]'
            s = center(pg, sel); d = center(pg, '.skill-slot[data-slot="3"]')
            def path_moves():
                # 來回三段、每段 20 步，取樣期間持續移動
                for (x0, y0, x1, y1) in [(s['x'] + 12, s['y'] + 6, d['x'], d['y']), (d['x'], d['y'], s['x'] + 40, s['y'] + 80), (s['x'] + 40, s['y'] + 80, d['x'], d['y'])]:
                    pg.mouse.move(x1, y1, steps=30)
            def run_drag(measure):
                pg.evaluate("()=>team20.reset()"); pg.mouse.move(s['x'], s['y']); pg.mouse.down(); pg.mouse.move(s['x'] + 12, s['y'] + 6, steps=2); pg.wait_for_timeout(50)
                if measure: pg.evaluate("()=>__perf.start()")
                path_moves()
                r = pg.evaluate("()=>__perf.stop()") if measure else None
                pg.mouse.up(); pg.wait_for_timeout(60); return r
            def run_baseline():
                pg.mouse.move(s['x'], s['y']); pg.evaluate("()=>__perf.start()"); path_moves(); return pg.evaluate("()=>__perf.stop()")
            run_drag(False)  # 暖機丟棄
            drags = [run_drag(True) for _ in range(3)]; bases = [run_baseline() for _ in range(3)]
            fps = lambda iv: 1000.0 / statistics.mean(iv[:60]) if len(iv) >= 60 else (1000.0 / statistics.mean(iv) if iv else 0.0)
            dfps = [fps(x['intervals']) for x in drags]; bfps = [fps(x['intervals']) for x in bases]
            S.check(f'{tag}.drag.samples_ge_60', all(len(x['intervals']) >= 60 for x in drags), True, note=str([len(x['intervals']) for x in drags]))
            S.check(f'{tag}.drag.fps_mean', round(statistics.mean(dfps), 1), 58.0, 1e9, note=str([round(v, 1) for v in dfps]))
            S.check(f'{tag}.drag.fps_min', round(min(dfps), 1), 55.0, 1e9)
            S.check(f'{tag}.baseline.fps_mean', round(statistics.mean(bfps), 1), 58.0, 1e9, note=str([round(v, 1) for v in bfps]))
            S.check(f'{tag}.drag.regression_pct', round((statistics.mean(bfps) - statistics.mean(dfps)) / statistics.mean(bfps) * 100, 2), -1e9, 5.0)
            S.check(f'{tag}.ghost_writes_le_frames', all(x['ghostWrites'] <= len(x['intervals']) + 1 for x in drags), True, note=str([(x['ghostWrites'], len(x['intervals'])) for x in drags]))
            S.check(f'{tag}.idle.rafPending', pg.evaluate("()=>team20.drag.rafPending"), False)
            pg.close()
        # 挑選器：1440@1.25、390@3，頂／底各三次、每次 3 秒
        for vw, vh, dpr in [(1440, 900, 1.25), (390, 844, 3)]:
            pg = open_team(br, vw, vh, dpr=dpr); tag = f'picker-{vw}x{vh}@{dpr}'
            pg.evaluate(PERF_JS); pg.evaluate("()=>team20.openPicker('skill',0)"); pg.wait_for_timeout(600)
            for pos in ['top', 'bottom']:
                pg.evaluate("(p)=>{const g=document.querySelector('#picker-grid');g.scrollTop=p==='top'?0:g.scrollHeight}", pos); pg.wait_for_timeout(300)
                vals = []
                for _ in range(3):
                    pg.evaluate("()=>__perf.start()"); pg.wait_for_timeout(3000); r = pg.evaluate("()=>__perf.stop()")
                    vals.append(len(r['intervals']) / (sum(r['intervals']) / 1000.0))
                S.check(f'{tag}.{pos}.fps_mean', round(statistics.mean(vals), 1), 58.0, 1e9, note=str([round(v, 1) for v in vals]))
                S.check(f'{tag}.{pos}.fps_min', round(min(vals), 1), 55.0, 1e9)
            pg.close()
        br.close()
    return S.finish(dict(renderer=renderer, note='58/55 是新功能門檻；單機單次路徑取樣，不跨機器比較'))


# ------------------------------------------------------------------ entry-pixels
def suite_entry_pixels(out, channel):
    S = Suite(out, 'entry-pixels')
    from scope3_capture import SCOPE
    results = []
    for vp in ['1440x1200', '1024x900', '390x844']:
        for card in ['rocketdog', 'chaichai', 'mieshi']:
            gate_dir = out / 'determinism' / vp; gate_dir.mkdir(parents=True, exist_ok=True)
            log = out / f'gate-{vp}-{card}.log'
            with log.open('wb') as f:
                rc = subprocess.run([sys.executable, 'check_shot_determinism.py', '--viewport', vp, '--card', card, '--out', str(gate_dir)], cwd=HERE, stdout=f, stderr=subprocess.STDOUT).returncode
            gate = gate_dir / f'{card}-result.json'
            dest = out / 'controlled' / vp; dest.mkdir(parents=True, exist_ok=True)
            prc = None
            if rc == 0:
                with (out / f'pixel-{vp}-{card}.log').open('wb') as f:
                    prc = subprocess.run([sys.executable, 'shoot_card_parity_samesize.py', '--viewport', vp, '--card', card, '--compare', '--determinism', str(gate), '--out', str(dest)], cwd=HERE, stdout=f, stderr=subprocess.STDOUT).returncode
            results.append(dict(viewport=vp, card=card, gateExit=rc, pixelExit=prc))
            S.check(f'{vp}.{card}.gate', rc, 0); S.check(f'{vp}.{card}.pixels', prc, 0)
            # 逐入口數字
            ev = dest / f'{card}-compare.json'
            for cand in dest.glob(f'*{card}*.json'):
                try:
                    j = json.loads(cand.read_text(encoding='utf-8'))
                except Exception:
                    continue
                pc = j.get('pixelComparison') or j.get('evidence', {}).get('pixelComparison')
                if pc and isinstance(pc, dict):
                    for name, v in (pc.get('entries') or pc.get('results') or {}).items():
                        if isinstance(v, dict) and 'mean' in v:
                            S.check(f'{vp}.{card}.{name}.mean', float(v['mean']), 0.0, 1.0); S.check(f'{vp}.{card}.{name}.over32', float(v['fractionOver32']), 0.0, 0.01); S.check(f'{vp}.{card}.{name}.std', float(v['luminanceStandardDeviation']), 8.0001, 1e9)
                    break
    S.check('gates', sum(1 for r in results if r['gateExit'] == 0), 9)
    return S.finish(dict(runs=results, scope=list(SCOPE)))


def run_suite(name, out, channel=None):
    return {'picker': suite_picker, 'drag': suite_drag, 'pixels': suite_pixels, 'negative': suite_negative,
            'perf': suite_perf, 'entry-pixels': suite_entry_pixels}[name](out, channel)

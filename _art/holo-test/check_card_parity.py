# -*- coding: utf-8 -*-
"""卡面一致性驗收器（ORDER-2026-09-11-parity.md 第 4 節規格）。

目標：同一張正式卡在抽卡揭卡、卡池、編隊總覽與詳情裡，卡面設計／字體階層／
配色／效果一致；尺寸差異只允許來自共用縮放規則。

用法：
    python check_card_parity.py [--root DIR] [--out DIR] [--entries a,b] [--viewports 1440x900,...]

輸出：<out>/parity-<label>.json（逐節點原始資料）與退出碼。
證據路徑預設從腳本位置推導，不依賴任何個人目錄。
"""
from __future__ import annotations
import argparse, hashlib, json, sys, io
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent

# ---------------------------------------------------------------- 頁面清單
ENTRIES = {
    'demo':                  dict(file='demo.html',                           surface='demo'),
    'demo-standalone':       dict(file='demo-standalone.html',                surface='demo'),
    'pool':                  dict(file='cards-remade.html',                   surface='pool'),
    'pool-standalone':       dict(file='cards-remade-standalone.html',        surface='pool'),
    'gacha':                 dict(file='deluxe-gacha-b.html',                 surface='gacha'),
    'gacha-standalone':      dict(file='deluxe-gacha-b-standalone.html',      surface='gacha'),
    'gacha-test':            dict(file='deluxe-gacha-b-test.html',            surface='gacha', fixture=True),
    'gacha-test-standalone': dict(file='deluxe-gacha-b-test-standalone.html', surface='gacha', fixture=True),
    'team':                  dict(file='map20.html',                          surface='team'),
}

# ---------------------------------------------------------------- 頁內腳本
WALK = r"""
window.__parity = (function(){
  function path(node){
    var out=[], r=node.getRootNode();
    while(r && r!==document){
      var h=r.host;
      if(!h) break;
      out.unshift(h.tagName.toLowerCase()+(h.className?'.'+String(h.className).trim().split(/\s+/).join('.'):''));
      r=h.getRootNode();
    }
    return out.join('>>') || 'document';
  }
  function cards(){
    var out=[];
    (function walk(root){
      root.querySelectorAll('.hcard').forEach(function(c){out.push(c)});
      root.querySelectorAll('*').forEach(function(e){if(e.shadowRoot)walk(e.shadowRoot)});
    })(document);
    return out;
  }
  function contentWidth(card){
    var cs=getComputedStyle(card), w=parseFloat(cs.width);
    if(cs.boxSizing==='border-box'){
      w-=parseFloat(cs.paddingLeft)+parseFloat(cs.paddingRight)+
         parseFloat(cs.borderLeftWidth)+parseFloat(cs.borderRightWidth);
    }
    return Math.max(0, w||0);
  }
  return {cards:cards, path:path, contentWidth:contentWidth};
})();
"""

COLLECT = r"""
() => {
  const P = window.__parity;
  const TEXT = ['fontFamily','fontSize','fontStyle','fontWeight','letterSpacing','lineHeight',
                'color','webkitTextFillColor','textShadow','backgroundImage','backgroundClip',
                'opacity','textTransform','whiteSpace','textAlign','filter','mixBlendMode'];
  const BOX  = ['width','height','padding','margin','gap','borderTopWidth','borderTopColor',
                'borderRadius','backgroundImage','backgroundColor','boxShadow','opacity',
                'transform','filter','mixBlendMode','left','right','top','bottom','position'];
  const pick = (el, props) => {
    if (!el) return null;
    const s = getComputedStyle(el), o = {};
    props.forEach(p => o[p] = s[p]);
    return o;
  };
  const range = el => {
    if (!el) return null;
    const r = document.createRange(); r.selectNodeContents(el);
    const list = [...r.getClientRects()];
    const b = r.getBoundingClientRect();
    return {w:+b.width.toFixed(3), h:+b.height.toFixed(3), lines:list.length};
  };
  const box = el => { if(!el) return null; const r = el.getBoundingClientRect();
    return {x:+r.x.toFixed(3), y:+r.y.toFixed(3), w:+r.width.toFixed(3), h:+r.height.toFixed(3)}; };

  const seen = {};
  window.__nodes = [];
  return P.cards().map(c => {
    const id = c.dataset.id || '(no-id)';
    const key = id + '@' + P.path(c);
    seen[key] = (seen[key] || 0) + 1;
    const n = c.querySelector('.face-name'), ra = c.querySelector('.face-rarity');
    const plate = c.querySelector('.face-plate'), gem = c.querySelector('.face-gem'),
          frame = c.querySelector('.face-frame');
    const cw = P.contentWidth(c);
    const nIdx = n ? (window.__nodes.push(n) - 1) : null;
    const rIdx = ra ? (window.__nodes.push(ra) - 1) : null;
    const cbox = box(c);
    const clear = el => {
      if (!el || !cbox || !cw) return null;
      const r = document.createRange(); r.selectNodeContents(el);
      const b = r.getBoundingClientRect();
      return {left:+((b.left-cbox.x)/cw).toFixed(5), right:+((cbox.x+cbox.w-b.right)/cw).toFixed(5)};
    };
    let gap = null;
    if (n && ra && cw) {
      const a=document.createRange(); a.selectNodeContents(n);
      const b=document.createRange(); b.selectNodeContents(ra);
      gap = +((b.getBoundingClientRect().top - a.getBoundingClientRect().bottom)/cw).toFixed(5);
    }
    let gemOverlap = null;
    if (gem && ra) {
      const g = gem.getBoundingClientRect();
      const r = document.createRange(); r.selectNodeContents(ra);
      const b = r.getBoundingClientRect();
      const ox = Math.max(0, Math.min(g.right,b.right)-Math.max(g.left,b.left));
      const oy = Math.max(0, Math.min(g.bottom,b.bottom)-Math.max(g.top,b.top));
      gemOverlap = +(ox*oy).toFixed(3);
    }
    return {
      id, canonicalId: id.replace(/^pool-/, ''), rarity: c.dataset.rarity || null, kind: (c.className.match(/kind-(\w+)/)||[])[1] || null,
      shadowPath: P.path(c), instance: seen[key] - 1,
      classes: [...c.classList].sort().join(' '),
      contentWidth: +cw.toFixed(3), box: cbox,
      nameFits: c.dataset.nameFits || null,
      nameFsVar: getComputedStyle(c).getPropertyValue('--name-fs').trim(),
      rarityFsVar: getComputedStyle(c).getPropertyValue('--rarity-fs').trim(),
      accentCard: getComputedStyle(c).getPropertyValue('--accent-card').trim(),
      nameInk: getComputedStyle(c).getPropertyValue('--name-ink').trim(),
      nameText: n ? n.textContent : null, rarityText: ra ? ra.textContent : null,
      nameStyle: pick(n, TEXT), rarityStyle: pick(ra, TEXT),
      nameRange: range(n), rarityRange: range(ra),
      nameClear: clear(n), rarityClear: clear(ra),
      lineGap: gap, gemOverlapArea: gemOverlap,
      plate: pick(plate, BOX), gem: pick(gem, BOX), frame: pick(frame, BOX),
      plateBox: box(plate), gemBox: box(gem),
      // 1.04 是 hover／選取的放大，抽卡結果面（.slot.done.selected）與編隊總覽
      // （[aria-selected=true]）共用同一條設計語言（ceremony.css / team20.css）。
      // 記下這張卡當下是不是那個狀態，才能把放大綁在狀態上而不是綁在畫面上。
      selectedState: (() => {
        const r = c.getRootNode();
        const a = r.host || c;
        return !!(a.closest && (a.closest('.slot.done.selected') ||
                                a.closest('.slot.done:hover') ||
                                a.closest('.team-proxy:hover') ||
                                a.closest('[aria-selected="true"]')));
      })(),
      nodeIndex: {name: nIdx, rarity: rIdx},
      // 有矩形不等於看得見：祖先隱藏、opacity 0、content-visibility 都要算進去，
      // 還要真的落在視窗裡（揭卡前卡片雖在 DOM，但不是揭開狀態）。
      visible: !!(cbox && cbox.w > 0 && cbox.h > 0
                  && (!c.checkVisibility || c.checkVisibility({opacityProperty:true,
                        visibilityProperty:true, contentVisibilityAuto:true}))),
      hasRect: !!(cbox && cbox.w > 0 && cbox.h > 0),
      inViewport: !!(cbox && cbox.y + cbox.h > 0 && cbox.y < innerHeight
                     && cbox.x + cbox.w > 0 && cbox.x < innerWidth),
    };
  });
}
"""

REFIT = r"""
async () => {
  const P = window.__parity;
  await document.fonts.ready;
  const imgs = [];
  (function walk(root){
    root.querySelectorAll('img').forEach(i => imgs.push(i));
    root.querySelectorAll('*').forEach(e => { if (e.shadowRoot) walk(e.shadowRoot) });
  })(document);
  await Promise.all(imgs.map(i => i.complete ? null : i.decode().catch(()=>{})));
  P.cards().forEach(c => { try { window.HoloCardFace && HoloCardFace.refit(c) } catch(e){} });
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
}
"""

FREEZE = r"""
() => {
  const all = [];
  (function walk(root){
    root.querySelectorAll('*').forEach(e => {
      if (e.getAnimations) all.push(...e.getAnimations());
      if (e.shadowRoot) walk(e.shadowRoot);
    });
  })(document);
  if (document.getAnimations) all.push(...document.getAnimations());
  all.forEach(a => { try { a.pause(); a.currentTime = 0 } catch(e){} });
  return all.length;
}
"""


def platform_fonts(cdp, index):
    """objectId -> nodeId，精準對應到指定元素；沒有筆數上限，錯誤不吞掉。"""
    try:
        # requestNode 需要先建立節點對應表，且要 pierce 進 shadow root
        cdp.send("DOM.getDocument", {"depth": -1, "pierce": True})
        ro = cdp.send("Runtime.evaluate", {"expression": "window.__nodes[%d]" % index})
        oid = ro.get("result", {}).get("objectId")
        if not oid:
            return {"error": "no objectId"}
        nid = cdp.send("DOM.requestNode", {"objectId": oid}).get("nodeId")
        if not nid:
            return {"error": "no nodeId"}
        fonts = cdp.send("CSS.getPlatformFontsForNode", {"nodeId": nid})["fonts"]
        return {"nodeId": nid,
                "fonts": [{"familyName": f["familyName"], "isCustomFont": f["isCustomFont"],
                           "glyphCount": f["glyphCount"]} for f in fonts]}
    except Exception as e:
        return {"error": str(e)[:200]}


# 固定抽卡序列：卡片紀錄直接由 Python 端的 pool() 提供（沿用既有 check_* 的做法），
# 只在 ?ceremony-test 的測試環境替換結果，不動正式機率。
FIXTURE_JS = """(cards)=>{
  if(!window.__ceremony) return 'no-ceremony';
  window.__ceremony.reset();
  window.__ceremonyFixture = cards;
  window.__ceremony.pull(cards.length);
  return 'ok';
}"""


def activate(pg, cfg, fixture_ids, fixture_cards):
    surface = cfg['surface']
    if surface == 'gacha':
        pg.wait_for_timeout(500)
        if cfg.get('fixture'):
            return {'role': 'reveal', 'fixture': fixture_ids, 'batched': True}
        # 正式版：用真實 UI 抽（機率沒有被動過），但一樣要把儀式走完才算揭到。
        # 只 pull 會停在卡包畫面，那時候的卡片不是揭開狀態。
        try:
            pg.click("#p10", timeout=3000)
        except Exception as e:
            return {'error': 'p10 click: %s' % str(e)[:80]}
        pg.wait_for_timeout(700)
        try:
            pg.evaluate("()=>__ceremony.openPack()")
        except Exception:
            try:
                pg.click("#entry-pack", timeout=2000)
            except Exception:
                pass
        pg.wait_for_timeout(900)
        try:
            pg.evaluate("()=>__ceremony.skipAll()")
            pg.evaluate("async()=>{await __ceremony.ready()}")
        except Exception as e:
            return {'error': 'skipAll/ready: %s' % str(e)[:80]}
        pg.wait_for_timeout(600)
        st = pg.evaluate("()=>__ceremony.state()")
        if st.get('screen') != 'results':
            return {'error': 'not revealed: screen=%s' % st.get('screen')}
        return {'role': 'reveal', 'fixture': None,
                'ceremony': [{'batch': 0, 'error': None, 'screen': st.get('screen'),
                              'complete': st.get('complete'), 'ids': None}],
                'drawnIds': st.get('ids')}
    if surface == 'team':
        try:
            pg.click("#open-team", timeout=5000)
        except Exception as e:
            return {'error': 'open-team: %s' % str(e)[:120]}
        pg.wait_for_timeout(1200)
        return {'role': 'overview'}
    pg.wait_for_timeout(1200)
    return {'role': 'grid'}


def role_of(card, default):
    """畫面角色由 shadow host 決定：overview-face 是總覽槽、card-host 是詳情浮層。"""
    path = card.get('shadowPath') or ''
    if 'overview-face' in path:
        return 'overview'
    if 'card-host' in path:
        return 'detail'
    return default


def pull_batch(pg, batch):
    """揭卡介面一次最多 10 張，所以固定序列要分批跑。

    ⚠ 只 pull 會停在「準備卡片…」的卡包畫面，卡片雖然進了 DOM 但根本沒揭開
    （2026-09-11 Astra 從截圖抓到）。要走完 openPack → skipAll → ready()，
    並且確認儀式狀態真的是 results、完成張數對得上，才算揭到。
    """
    ok = pg.evaluate(FIXTURE_JS, batch)
    if ok != 'ok':
        return 'fixture failed: %s' % ok, None
    pg.wait_for_timeout(600)
    try:
        pg.evaluate("()=>__ceremony.openPack()")
    except Exception:
        pass
    pg.wait_for_timeout(900)
    try:
        pg.evaluate("()=>__ceremony.skipAll()")
    except Exception as e:
        return 'skipAll failed: %s' % str(e)[:80], None
    pg.wait_for_timeout(900)
    try:
        pg.evaluate("async()=>{await __ceremony.ready()}")
    except Exception:
        pass
    pg.wait_for_timeout(500)
    st = pg.evaluate("()=>__ceremony.state()")
    if st.get('screen') != 'results':
        return 'not revealed: screen=%s' % st.get('screen'), st
    if st.get('complete') != len(batch):
        return 'incomplete reveal: %s/%s' % (st.get('complete'), len(batch)), st
    got = st.get('ids') or []
    want = [c['id'] for c in batch]
    if got != want:
        return 'reveal order mismatch: %s vs %s' % (got, want), st
    return None, st


# 讓指定的卡真的出現在編隊畫面上。初始隊伍只有 10 位，其餘 14 張要用產品本來就有的
# 「替換成員」把它換進來（同階級互換，不動四條累加上限，也不改編隊資料）。
REACH_CARD = """(id)=>{
  const t = window.team20;
  if(!t) return 'no-api';
  const c = t.cards.find(x=>x.id===id);
  if(!c) return 'unknown';
  if(t.roster.includes(id)){ t.select(id, true); return 'in-roster'; }
  const same = t.roster.find(r=>{const x=t.cards.find(y=>y.id===r); return x && x.rarity===c.rarity});
  if(!same) return 'no-same-rarity-slot';
  if(!t.add(id, same)) return 'rejected';
  t.select(id, true);
  return 'replaced:'+same;
}"""


# 同尺寸中性姿態：把每張卡就地設成同一個未變形 content-box 寬度、關掉所有 transform，
# 再 refit 一次。留在原本的容器與 shadow root 裡，只換寬度與姿態，
# 這樣幾何就能用未變形寬度當基準比較，不必拿投影寬去抵銷選取放大。
SAMESIZE_JS = """(w)=>{
  const cs=[]; (function walk(r){r.querySelectorAll('.hcard').forEach(c=>cs.push(c));
    r.querySelectorAll('*').forEach(e=>{if(e.shadowRoot)walk(e.shadowRoot)})})(document);
  const roots=new Set(cs.map(c=>c.getRootNode()));
  roots.add(document);
  roots.forEach(r=>{const s=document.createElement('style');s.className='__samesize';
    // 祖先的 transform（例如編隊 1.04 選取放大掛在外層）也要一起關掉，
    // 只關卡片自己的話投影倍率還在，量到的 Range 仍然差 4%。
    // 選取放大是 CSS 的 scale 屬性（team20.css:142），不是 transform，
    // 只關 transform 關不掉；rotate/translate 同一組獨立屬性也一起關。
    s.textContent='*{transform:none !important;scale:none !important;'+
                  'rotate:none !important;translate:none !important;'+
                  'transition:none !important;animation:none !important;'+
                  'perspective:none !important}';
    (r.head||r).appendChild(s)});
  cs.forEach(c=>{c.dataset.prevStyle=c.getAttribute('style')||'';
    c.style.width=w+'px';c.style.height=(w*7/5)+'px';c.style.boxSizing='content-box'});
  cs.forEach(c=>{try{HoloCardFace.refit(c)}catch(e){}});
  // 箔面／光影是靠 paint(card, rarity, x, y) 的指標座標決定的，凍結 WAAPI 動畫關不掉。
  // 統一 paint 到「指標在正中央、不傾斜」，每張卡才在同一個相位上，
  // 否則同尺寸截圖比像素會被箔面相位主導（2026-09-11 實測到平均差 51/255）。
  cs.forEach(c=>{try{HoloCardFace.paint(c, c.dataset.rarity, 0, 0, {tilt:false})}catch(e){}});
  return cs.length;
}"""

SAMESIZE_RESTORE = """()=>{
  const cs=[]; (function walk(r){r.querySelectorAll('.hcard').forEach(c=>cs.push(c));
    r.querySelectorAll('*').forEach(e=>{if(e.shadowRoot)walk(e.shadowRoot)});
    r.querySelectorAll('.__samesize').forEach(s=>s.remove())})(document);
  cs.forEach(c=>{const prev=c.dataset.prevStyle;
    if(prev)c.setAttribute('style',prev);else c.removeAttribute('style');
    delete c.dataset.prevStyle;});
  cs.forEach(c=>{try{HoloCardFace.refit(c)}catch(e){}});
}"""


# ---------------------------------------------------------------- 負控制
# 注進「卡片實際所在的 root」（編隊的卡在 shadow root 裡，注在頁面層等於沒注）。
INJECTIONS = {
    'mono':        '.hcard .face-rarity{font-family:monospace !important}',
    'epic-accent': '.hcard .face-rarity{color:var(--accent-card) !important;'
                   '-webkit-text-fill-color:var(--accent-card) !important}',
    'wrap':        '.hcard .face-rarity{white-space:normal !important;letter-spacing:2em !important}',
}

INJECT_JS = """(css)=>{
  const cs=[]; (function w(r){r.querySelectorAll('.hcard').forEach(c=>cs.push(c));
    r.querySelectorAll('*').forEach(e=>{if(e.shadowRoot)w(e.shadowRoot)})})(document);
  const roots=new Set(cs.map(c=>c.getRootNode()));
  roots.forEach(r=>{const s=document.createElement('style');s.className='__neg';s.textContent=css;(r.head||r).appendChild(s)});
  return roots.size;
}"""

DROP_JS = """()=>{
  const cs=[]; (function w(r){r.querySelectorAll('.hcard').forEach(c=>cs.push(c));
    r.querySelectorAll('*').forEach(e=>{if(e.shadowRoot)w(e.shadowRoot)})})(document);
  if(!cs.length) return null;
  const victim = cs[0]; const id = victim.dataset.id; victim.remove(); return id;
}"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--root', default=str(HERE))
    ap.add_argument('--out', default=str(REPO / 'docs' / 'clicker' / 'shots' / 'parity'))
    ap.add_argument('--entries', default=','.join(ENTRIES))
    ap.add_argument('--viewports', default='1440x900,1024x900,390x844')
    ap.add_argument('--label', default='run')
    ap.add_argument('--fixture', default='beachball,chaichai,zhenpete,rocketdog,alienkitty')
    ap.add_argument('--shots', action='store_true')
    ap.add_argument('--samesize', type=int, default=260,
                    help='同尺寸中性姿態的卡寬（px）；0 = 不做這一趟')
    ap.add_argument('--inject', default=None,
                    choices=list(INJECTIONS) + ['drop-card'],
                    help='負控制：故意弄壞，驗收器必須因此退出非零')
    args = ap.parse_args()

    root = Path(args.root).resolve()
    out = Path(args.out).resolve()
    out.mkdir(parents=True, exist_ok=True)
    viewports = [tuple(int(x) for x in v.split('x')) for v in args.viewports.split(',')]
    entries = [e for e in args.entries.split(',') if e in ENTRIES]
    fixture_ids = args.fixture.split(',')

    sys.path.insert(0, str(root))
    from pool_data import pool
    expected = {c['id']: c for c in pool()}
    if args.fixture.strip() == 'auto':
        # 全量對照：固定序列＝整個正式卡池，這樣卡池／編隊每一張都有揭卡參考對象
        fixture_ids = sorted(expected)
        print('固定序列 auto：整個正式卡池 %d 張' % len(fixture_ids))
    missing_fixture = [i for i in fixture_ids if i not in expected]
    if missing_fixture:
        print('!! fixture 指定的卡不在卡池: %s' % missing_fixture)
        return 2
    fixture_cards = [expected[i] for i in fixture_ids]

    result = {
        'label': args.label,
        'root': str(root),
        'viewports': ['%dx%d' % v for v in viewports],
        'expectedPoolIds': sorted(expected),
        'expectedTeamIds': (lambda m: [c['id'] for c in json.loads(m.group(1))['cards']] if m else [])(
            __import__('re').search(r'const TEAM_DATA=(\{.*?\});',
                                    (root / 'map20.html').read_text(encoding='utf-8'), __import__('re').S)),
        'fixtureIds': fixture_ids,
        'sourceHashes': {p.name: hashlib.sha256(p.read_bytes()).hexdigest()[:16]
                         for p in sorted(root.glob('*.html'))},
        'inject': args.inject,
        'entries': {},
    }

    with sync_playwright() as pw:
        br = pw.chromium.launch()
        result['chromium'] = br.version
        for name in entries:
            cfg = ENTRIES[name]
            f = root / cfg['file']
            if not f.exists():
                result['entries'][name] = {'error': 'missing file'}
                print('!! %s: 檔案不存在 %s' % (name, f))
                continue
            result['entries'][name] = {'file': cfg['file'], 'surface': cfg['surface'], 'viewports': {}}
            for w, h in viewports:
                pg = br.new_page(viewport={'width': w, 'height': h}, device_scale_factor=1)
                page_errors = []
                pg.on('pageerror', lambda e: page_errors.append(str(e)[:200]))
                pg.on('console', lambda m: page_errors.append('console.%s: %s' % (m.type, m.text[:160]))
                      if m.type == 'error' else None)
                cdp = pg.context.new_cdp_session(pg)
                cdp.send('DOM.enable'); cdp.send('CSS.enable'); cdp.send('Runtime.enable')
                vp = '%dx%d' % (w, h)
                try:
                    pg.add_init_script(WALK)
                    pg.goto(f.as_uri() + ('?ceremony-test' if cfg['surface'] == 'gacha' else ''))
                    pg.evaluate(WALK)
                    act = activate(pg, cfg, fixture_ids, fixture_cards)
                    cards = []
                    anims = 0
                    batches = ([fixture_cards[i:i + 10] for i in range(0, len(fixture_cards), 10)]
                               if cfg.get('fixture') else [None])
                    for bi, batch in enumerate(batches):
                        if batch is not None:
                            err, cst = pull_batch(pg, batch)
                            act.setdefault('ceremony', []).append(
                                {'batch': bi, 'error': err,
                                 'screen': (cst or {}).get('screen'),
                                 'complete': (cst or {}).get('complete'),
                                 'ids': (cst or {}).get('ids')})
                            if err:
                                act = {'error': '%s (batch %d)' % (err, bi)}
                                break
                        pg.evaluate(WALK)
                        pg.evaluate(REFIT)
                        # 手機尺寸下 demo／卡池的卡全在摺線以下，不捲一下等於畫面上看不到卡。
                        pg.evaluate("""()=>{const cs=[];
                          (function w(r){r.querySelectorAll('.hcard').forEach(c=>cs.push(c));
                            r.querySelectorAll('*').forEach(e=>{if(e.shadowRoot)w(e.shadowRoot)})})(document);
                          if(cs.length) cs[0].scrollIntoView({block:'center'});}""")
                        pg.wait_for_timeout(250)
                        if args.inject:
                            if args.inject == 'drop-card':
                                dropped = pg.evaluate(DROP_JS)
                                act.setdefault('injected', []).append('drop:%s' % dropped)
                            else:
                                n_roots = pg.evaluate(INJECT_JS, INJECTIONS[args.inject])
                                act.setdefault('injected', []).append(
                                    '%s -> %d roots' % (args.inject, n_roots))
                            pg.wait_for_timeout(300)
                            pg.evaluate(REFIT)
                        anims = max(anims, pg.evaluate(FREEZE))
                        got = pg.evaluate(COLLECT)
                        for c in got:
                            c['role'] = role_of(c, act.get('role'))
                            c['entry'] = name
                            c['viewport'] = vp
                            c['batch'] = bi
                            c['platformFonts'] = {}
                            for part in ('name', 'rarity'):
                                i = c['nodeIndex'][part]
                                c['platformFonts'][part] = (platform_fonts(cdp, i) if i is not None
                                                            else {'error': 'no node'})
                        if cfg['surface'] == 'team':
                            # 詳情浮層這時還沒開，card-host 裡的卡是「未開啟」狀態，
                            # 不是有效樣本；逐卡打開之後才收。
                            got = [c for c in got if 'card-host' not in (c.get('shadowPath') or '')]
                        cards.extend(got)
                        if args.samesize:
                            n = pg.evaluate(SAMESIZE_JS, args.samesize)
                            pg.evaluate("()=>new Promise(r=>requestAnimationFrame("
                                        "()=>requestAnimationFrame(r)))")
                            for d in pg.evaluate(COLLECT):
                                if (cfg['surface'] == 'team'
                                        and 'card-host' in (d.get('shadowPath') or '')):
                                    continue      # 同上：詳情浮層還沒開
                                d['role'] = role_of(d, act.get('role'))
                                d['entry'] = name; d['viewport'] = vp; d['batch'] = bi
                                d['pose'] = 'neutral'; d['sameSizeWidth'] = args.samesize
                                d['platformFonts'] = {}
                                cards.append(d)
                            pg.evaluate(SAMESIZE_RESTORE)
                            pg.evaluate(REFIT)
                    if cfg['surface'] == 'team':
                        all_ids = pg.evaluate("()=>window.team20?window.team20.cards.map(c=>c.id):[]")
                        act['teamCardCount'] = len(all_ids)
                        act['reach'] = {}
                        seen_roles = {(c['id'], c['role'], c['shadowPath'], c.get('instance', 0))
                                      for c in cards}
                        for cid in all_ids:
                            how = pg.evaluate(REACH_CARD, cid)
                            act['reach'][cid] = how
                            if how in ('no-api', 'unknown', 'no-same-rarity-slot', 'rejected'):
                                cards.append({'id': cid, 'role': 'detail', 'entry': name,
                                              'viewport': vp, 'error': 'unreachable: %s' % how})
                                continue
                            # 手機的詳情浮層有開場動畫，第一張常常還沒排版好就被量到
                            # （2026-09-11 Astra 抓到 390 的 rocketdog 是 auto／16.2%）。
                            ok_open = False
                            for _ in range(12):
                                pg.wait_for_timeout(250)
                                ok_open = pg.evaluate("""(id)=>{
                                  const cs=[];(function w(r){r.querySelectorAll('.hcard').forEach(c=>cs.push(c));
                                    r.querySelectorAll('*').forEach(e=>{if(e.shadowRoot)w(e.shadowRoot)})})(document);
                                  const c=cs.find(c=>c.dataset.id===id &&
                                    (c.getRootNode().host||{}).id==='card-host');
                                  if(!c) return false;
                                  const r=c.getBoundingClientRect();
                                  return r.width>0 && r.height>0;
                                }""", cid)
                                if ok_open:
                                    break
                            if not ok_open:
                                cards.append({'id': cid, 'role': 'detail', 'entry': name,
                                              'viewport': vp,
                                              'error': 'detail overlay never laid out'})
                                continue
                            pg.evaluate(WALK); pg.evaluate(REFIT); pg.evaluate(FREEZE)
                            for d in pg.evaluate(COLLECT):
                                if d['id'] != cid or d['shadowPath'] == 'document':
                                    continue
                                role = role_of(d, 'detail')
                                inst_key = (cid, role, d['shadowPath'], d.get('instance', 0))
                                if inst_key in seen_roles:
                                    continue
                                seen_roles.add(inst_key)
                                d['role'] = role; d['entry'] = name; d['viewport'] = vp
                                d['reach'] = how
                                d['platformFonts'] = {}
                                for part in ('name', 'rarity'):
                                    i = d['nodeIndex'][part]
                                    d['platformFonts'][part] = (platform_fonts(cdp, i) if i is not None
                                                                else {'error': 'no node'})
                                cards.append(d)
                            if args.samesize:
                                pg.evaluate(SAMESIZE_JS, args.samesize)
                                pg.evaluate("()=>new Promise(r=>requestAnimationFrame("
                                            "()=>requestAnimationFrame(r)))")
                                for d in pg.evaluate(COLLECT):
                                    if d['id'] != cid or d['shadowPath'] == 'document':
                                        continue
                                    d['role'] = role_of(d, 'detail')
                                    d['entry'] = name; d['viewport'] = vp
                                    d['pose'] = 'neutral'; d['sameSizeWidth'] = args.samesize
                                    d['platformFonts'] = {}
                                    cards.append(d)
                                pg.evaluate(SAMESIZE_RESTORE)
                                pg.evaluate(REFIT)
                    broken = pg.evaluate("""()=>{const out=[];
                      (function w(r){r.querySelectorAll('img').forEach(i=>{
                        if(i.complete && i.naturalWidth===0) out.push(i.src.slice(0,80))});
                        r.querySelectorAll('*').forEach(e=>{if(e.shadowRoot)w(e.shadowRoot)})})(document);
                      return out}""")
                    rec = {'activation': act, 'animationsFrozen': anims, 'cards': cards,
                           'pageErrors': page_errors, 'brokenImages': broken}
                    if args.shots and cards:
                        sd = out / 'shots' / args.label / name
                        sd.mkdir(parents=True, exist_ok=True)
                        try:
                            pg.screenshot(path=str(sd / ('%s.png' % vp)))
                        except Exception as e:
                            rec['shotError'] = str(e)[:120]
                    result['entries'][name]['viewports'][vp] = rec
                    bad = sum(1 for c in cards for p in ('name', 'rarity')
                              if c.get('platformFonts', {}).get(p, {}).get('error'))
                    print('  %-22s %-9s %3d 張，字型取樣錯誤 %d，凍結動畫 %d'
                          % (name, vp, len(cards), bad, anims))
                except Exception as e:
                    result['entries'][name]['viewports'][vp] = {'error': str(e)[:300]}
                    print('!! %s %s: %s' % (name, vp, str(e)[:150]))
                finally:
                    pg.close()
        br.close()

    p = out / ('parity-%s.json' % args.label)
    p.write_text(json.dumps(result, ensure_ascii=False, indent=1), encoding='utf-8')
    print('\n寫出 %s' % p)
    return 0


if __name__ == '__main__':
    sys.exit(main())

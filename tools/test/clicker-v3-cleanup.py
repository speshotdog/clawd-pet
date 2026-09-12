# -*- coding: utf-8 -*-
"""v3 大掃除驗收：v2 存檔（祝福 Lv.1462、12 次輪迴）第一次載入 → 整頁結算出現一次；收下後不再出現；徽章「舊時代的珍母」入袋。
用法：PYTHONIOENCODING=utf-8 python tools/test/clicker-v3-cleanup.py"""
import mimetypes, sys
from pathlib import Path
from urllib.parse import unquote, urlparse
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
SRC, OUT = ROOT / 'src', ROOT / '_art/out/v3-cleanup'
OUT.mkdir(parents=True, exist_ok=True)
fails = []


def check(ok, msg):
    print(('ok   ' if ok else 'FAIL ') + msg)
    if not ok:
        fails.append(msg)


# 舊版存檔：直接寫 v2 形狀（沒有 v3 欄位），數字照使用者截圖
V2 = """() => { const S=ClickerSave,B=ClickerBalance; const s=S.fresh(Date.now());
  for (const k of ['roster','runWins','runPacks','runGates','champions','artifacts','dispatch','dispatchDay','dispatchHalf','chestSeed','legacy']) delete s[k];
  delete s.settings.autoChallenge; s.version=2;
  const ids=Object.keys(B.characters); s.collection=Object.fromEntries(ids.map(i=>[i,20])); s.dust={...s.collection};
  s.coins=1e15; s.lifetimeCoins=1.1e20; s.manualClicks=50; s.claimedMilestones=['tutorial50'];
  s.prestiges=12; s.marksClaimed=1069453; s.marks=1500; s.blessing=1462; s.markShop={slot4:true,bossTime:true}; s.skillSlots=[null,null,null,null]; s.slotReadyAt=[0,0,0,0];
  s.bossWins=['backyard','kitchen','market','factory','nightmarket','fridge','city']; s.badges=['pack10','pack25'];
  sessionStorage.setItem('test-seed',JSON.stringify(s)); }"""


def open_page(p, seed):
    b = p.chromium.launch(headless=True)
    ctx = b.new_context(viewport={'width': 1280, 'height': 860}, device_scale_factor=1, reduced_motion='reduce')

    def route(r):
        path = (SRC / unquote(urlparse(r.request.url).path).lstrip('/')).resolve()
        if not path.is_relative_to(SRC) or not path.is_file():
            r.fulfill(status=404, body='missing'); return
        r.fulfill(body=path.read_bytes(), content_type=mimetypes.guess_type(path)[0] or 'application/octet-stream')
    ctx.route('**/*', route)
    ctx.add_init_script("const s=sessionStorage.getItem('test-seed'); if(s){localStorage.setItem('clicker_save',s);sessionStorage.removeItem('test-seed');}")
    pg = ctx.new_page(); errors = []
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.goto('http://clicker.test/clicker.html'); pg.wait_for_function('window.Clicker?.state')
    if seed: pg.evaluate(seed); pg.reload()
    pg.wait_for_function('window.Clicker?.state'); pg.wait_for_timeout(1200)
    return b, pg, ctx, errors


with sync_playwright() as p:
    b, pg, ctx, errors = open_page(p, V2)
    st = pg.evaluate("()=>({v:Clicker.state.version, b:Clicker.state.blessing, m:Clicker.state.marks, c:Clicker.state.marksClaimed, L:Clicker.state.legacy, badges:Clicker.state.badges, roster:Clicker.state.roster.length, champs:Clicker.state.champions})")
    check(st['v'] == 3 and st['b'] == 16 and st['m'] == 8 and st['L'] and st['L']['blessing'] == 1462, '遷移：v3、祝福 16、印記 8、legacy 封存 ' + str({k: st[k] for k in ('v','b','m','c')}))
    check(st['roster'] == 20 and len(st['champs']) == 2, '自動編隊 20、當家 2')
    check(not pg.evaluate("()=>document.getElementById('cleanup').hidden"), '大掃除頁出現')
    body = pg.text_content('#cleanup-body')
    check('1,069,453' in body and 'Lv.1,462 → Lv.16' in body and '舊時代的珍母' in body and '魔花少女' in body, '結算內容：保留／整理／補償都在')
    check(pg.evaluate("()=>document.getElementById('cleanup-explain').hidden"), '「這是怎麼算的」預設收起')
    pg.screenshot(path=str(OUT / '1-cleanup.png'))
    pg.click('#cleanup-why'); pg.wait_for_timeout(200)
    check(not pg.evaluate("()=>document.getElementById('cleanup-explain').hidden") and '12 × 每輪上限 12' in pg.text_content('#cleanup-explain'), '展開算法')
    pg.screenshot(path=str(OUT / '2-cleanup-why.png'))
    pg.click('#cleanup-ok'); pg.wait_for_timeout(600)
    check(pg.evaluate("()=>document.getElementById('cleanup').hidden") and pg.evaluate("()=>!!Clicker.state.legacy.seen && Clicker.state.legacy.reset===false"), '保留進度：頁關閉、legacy.seen、reset=false')
    check('oldtimes' not in pg.evaluate("()=>Clicker.state.badges") and pg.evaluate("()=>Clicker.state.collectibles.length") == 0, '保留進度：沒有徽章、沒有收藏卡')
    check(pg.evaluate("()=>Object.keys(Clicker.state.collection).length") == 52, '保留進度：夥伴都在')
    pg.reload(); pg.wait_for_function('window.Clicker?.state'); pg.wait_for_timeout(1200)
    check(pg.evaluate("()=>document.getElementById('cleanup').hidden"), '重整後不再出現')
    check(not errors, '頁面錯誤 0：' + '; '.join(errors)[:300])
    b.close()
    # 第二份：選「從零開始」→ 新存檔、legacy.reset、徽章與收藏卡入袋、夥伴歸零
    b, pg, ctx, errors = open_page(p, V2)
    pg.click('#cleanup-reset'); pg.wait_for_timeout(200); check('再按一次' in pg.text_content('#cleanup-reset'), '從零開始要按兩次')
    pg.click('#cleanup-reset'); pg.wait_for_timeout(1200)
    st = pg.evaluate("()=>({hidden:document.getElementById('cleanup').hidden, reset:Clicker.state.legacy.reset, seen:!!Clicker.state.legacy.seen, badges:Clicker.state.badges, col:Clicker.state.collectibles, partners:Object.keys(Clicker.state.collection).length, coins:Clicker.state.coins, marks:Clicker.state.marksClaimed, legacyMarks:Clicker.state.legacy.marksClaimed})")
    check(st['hidden'] and st['reset'] is True and st['seen'], '從零開始：頁關閉、legacy.reset=true ' + str({k:st[k] for k in ('reset','seen')}))
    check('oldtimes' in st['badges'] and st['col'] == ['mohuashaonv'], '徽章與魔花少女入袋 ' + str((st['badges'], st['col'])))
    check(st['partners'] == 0 and st['coins'] == 0 and st['marks'] == 0 and st['legacyMarks'] == 1069453, '進度歸零、舊數字仍封存 ' + str((st['partners'], st['coins'], st['marks'])))
    check(not pg.evaluate("()=>document.getElementById('reward').hidden") and '魔花少女' in pg.text_content('#reward') and '舊時代的珍母' in pg.text_content('#reward'), '獎勵視窗：卡與徽章')
    pg.screenshot(path=str(OUT / '3-reset.png'))
    pg.click('#reward-ok'); pg.wait_for_timeout(300); check(pg.evaluate("()=>document.getElementById('reward').hidden"), '收下 → 關閉')
    snap = pg.evaluate("()=>Clicker.state.legacy.snapshot"); check(snap and len(snap['collection']) == 52 and snap['prestiges'] == 12, '進度快照封存（52 隻、12 輪）')
    pg.click('#stats-open'); pg.wait_for_timeout(400); check(not pg.evaluate("()=>document.getElementById('memento-open').hidden"), '徽章牆有「舊時代的相簿」鍵')
    pg.click('#memento-open'); pg.wait_for_timeout(600)
    check(pg.evaluate("()=>document.querySelectorAll('#memento-grid .memento-cell').length") == 52 and '輪迴 12 次' in pg.text_content('#memento-summary'), '相簿：52 張舊卡＋摘要')
    pg.screenshot(path=str(OUT / '4-memento.png')); pg.click('#memento-close'); pg.wait_for_timeout(200)
    pg.reload(); pg.wait_for_function('window.Clicker?.state'); pg.wait_for_timeout(1200)
    check(pg.evaluate("()=>document.getElementById('cleanup').hidden") and pg.evaluate("()=>Clicker.state.collectibles.length") == 1, '重整後不再出現、收藏卡還在')
    check(not errors, '頁面錯誤 0：' + '; '.join(errors)[:300])
    b.close()

print('\n%d FAIL' % len(fails) if fails else '\nALL OK'); sys.exit(1 if fails else 0)

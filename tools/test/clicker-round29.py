# -*- coding: utf-8 -*-
"""第二十九輪驗收：系統開了「減少動畫」時，收益浮字仍然要看得到。
2026-09-08 使用者回報「部分玩家看不到被動傷害的顯示」。真兇：float() 與 floatPassive()
開頭都擋 reduced.matches，於是那些玩家一個浮字都沒有——數字是資訊不是裝飾，
減少動畫該減的是位移，不是把讀數整個拿掉。
（這條自己開一個瀏覽器：被動浮字靠 1Hz 結算，分頁在背景會被節流，混在別的套件裡會偶發假失敗。）
用法：PYTHONIOENCODING=utf-8 python tools/test/clicker-round29.py"""
import mimetypes, sys
from pathlib import Path
from urllib.parse import unquote, urlparse
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'src'
fails = []

def check(ok, msg):
    print(('ok   ' if ok else 'FAIL ') + msg)
    if not ok: fails.append(msg)

SEED = """() => { const S=ClickerSave, s=S.fresh(Date.now());
  const ids=Object.keys(ClickerBalance.characters);
  s.collection=Object.fromEntries(ids.map(i=>[i,5]));
  s.partnerLevels=Object.fromEntries(ids.map(i=>[i,30]));
  s.clickLevel=40; s.trainingLevel=10; s.coins=1e8; s.lifetimeCoins=1e9;
  s.manualClicks=50; s.claimedMilestones=['tutorial50'];
  S.validate(s,GachaPool); sessionStorage.setItem('test-seed',JSON.stringify(s)); }"""

PROBE = """() => {
  const all=[...document.querySelectorAll('.floater')];
  const moving = all.some(e => ((e.getAnimations()[0] && e.getAnimations()[0].effect.getKeyframes()) || [])
    .some(k => k.transform && /-[1-9]\d*px/.test(String(k.transform))));
  return {all: all.length, visible: all.filter(e=>e.getBoundingClientRect().width>0).length,
          passive: document.querySelectorAll('.floater.passive').length, moving}; }"""


def measure(reduced):
    """回傳 (點擊浮字看得到幾個, 被動浮字看得到幾個, 有沒有位移, JS 錯誤)"""
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True)
        ctx = b.new_context(viewport={'width': 1280, 'height': 860}, reduced_motion=reduced)
        def route(r):
            path = (SRC / unquote(urlparse(r.request.url).path).lstrip('/')).resolve()
            if not path.is_relative_to(SRC) or not path.is_file():
                r.fulfill(status=404, body='missing'); return
            r.fulfill(body=path.read_bytes(),
                      content_type=mimetypes.guess_type(path)[0] or 'application/octet-stream')
        ctx.route('**/*', route)
        ctx.add_init_script("const s=sessionStorage.getItem('test-seed'); if(s){localStorage.setItem('clicker_save',s);sessionStorage.removeItem('test-seed');}")
        pg = ctx.new_page(); errors = []
        pg.on('pageerror', lambda e: errors.append(str(e)))
        pg.goto('http://clicker.test/clicker.html')
        pg.wait_for_function('window.Clicker?.state')
        pg.evaluate(SEED)
        pg.reload(); pg.wait_for_function('!document.getElementById("tap").disabled')
        pg.wait_for_timeout(1200)
        click_seen = passive_seen = 0; moving = False
        for _ in range(8):
            pg.locator('#tap').click(position={'x': 60, 'y': 60}, force=True)
            pg.wait_for_timeout(90)
            r = pg.evaluate(PROBE)
            click_seen = max(click_seen, r['visible']); moving = moving or r['moving']
            pg.wait_for_timeout(350)
            r = pg.evaluate(PROBE)
            passive_seen = max(passive_seen, r['passive']); moving = moving or r['moving']
        b.close()
        return click_seen, passive_seen, moving, errors


def main():
    normal = measure('no-preference')
    print(f'  一般設定：點擊浮字 {normal[0]} 個、被動浮字 {normal[1]} 個、有位移={normal[2]}')
    check(normal[0] > 0 and normal[1] > 0, '一般設定下兩種浮字都看得到（對照組）')
    check(normal[2], '一般設定下浮字會往上飄')
    check(not normal[3], f'一般設定沒有 JS 錯誤：{normal[3]}')

    red = measure('reduce')
    print(f'  減少動畫：點擊浮字 {red[0]} 個、被動浮字 {red[1]} 個、有位移={red[2]}')
    check(red[0] > 0, f'減少動畫時點擊浮字仍然看得到（修好前是 0）：{red[0]} 個')
    check(red[1] > 0, f'減少動畫時被動收益浮字仍然看得到（修好前是 0）：{red[1]} 個')
    check(not red[2], f'但它們不再位移，尊重「減少動畫」：有位移={red[2]}')
    check(not red[3], f'減少動畫沒有 JS 錯誤：{red[3]}')

    print()
    if fails:
        print(f'{len(fails)} 項未過：')
        for f in fails: print('  - ' + f)
        sys.exit(1)
    print('全部通過')

if __name__ == '__main__':
    main()

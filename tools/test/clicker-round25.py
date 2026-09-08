# -*- coding: utf-8 -*-
"""第二十五輪驗收：存檔自動修復，以及「錯誤畫面裡貼存檔救回」這條退路。
2026-09-08 使用者朋友卡住的死循環：存檔壞掉 → 錯誤畫面 → 匯入鍵在被 inert 的 #stats 裡 → 貼不進去。
用法：PYTHONIOENCODING=utf-8 python tools/test/clicker-round25.py"""
import json, mimetypes, sys
from pathlib import Path
from urllib.parse import unquote, urlparse
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
SRC, OUT = ROOT / 'src', ROOT / '_art/out'
fails = []

def check(ok, msg):
    print(('ok   ' if ok else 'FAIL ') + msg)
    if not ok: fails.append(msg)

# 一份玩很久的存檔，等一下拿它去壞
SEED = """() => {
  const S=ClickerSave;
  const s=S.fresh(Date.now());
  const ids=Object.keys(ClickerBalance.characters);
  s.collection=Object.fromEntries(ids.map(id=>[id,5]));
  s.partnerLevels=Object.fromEntries(ids.map(id=>[id,60]));
  s.skillSlots=['zhenmu','yueyue2',null];
  s.clickLevel=60; s.trainingLevel=20; s.coins=1e12; s.lifetimeCoins=5e12;
  s.bossWins=['backyard','kitchen']; s.badges=['pack10','pack25','boss-backyard'];
  S.validate(s,GachaPool);
  return JSON.stringify(s);
}"""

def main():
    OUT.mkdir(exist_ok=True)
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True)
        ctx = b.new_context(viewport={'width':1280,'height':860})
        def route(r):
            path = (SRC / unquote(urlparse(r.request.url).path).lstrip('/')).resolve()
            if not path.is_relative_to(SRC) or not path.is_file():
                r.fulfill(status=404, body='missing'); return
            r.fulfill(body=path.read_bytes(),
                      content_type=mimetypes.guess_type(path)[0] or 'application/octet-stream')
        ctx.route('**/*', route)
        # ⚠ 不能直接寫 localStorage 再 reload：頁面上那一份還活著，它的定時存檔會在
        # 我們寫進去之後、reload 之前把種子蓋掉（實測種子 3093 位元組被換成 3155 的全新存檔）。
        # 所以照其他套件的做法，種進 sessionStorage，由 init script 在下一次載入時搬過去。
        ctx.add_init_script("const s=sessionStorage.getItem('test-seed'); if(s){localStorage.setItem('clicker_save',s);sessionStorage.removeItem('test-seed');}")
        # #notice 是 1.4 秒就自己消失的浮動訊息，等遊戲載完再去看一定是空的。全程錄下來。
        ctx.add_init_script("""(() => { window.__notices=[];
          addEventListener('DOMContentLoaded', () => {
            const el=document.getElementById('notice'); if(!el) return;
            new MutationObserver(() => { const t=el.textContent; if(t && !el.hidden) window.__notices.push(t); })
              .observe(el, {childList:true, characterData:true, subtree:true, attributes:true});
          });
        })();""")
        pg = ctx.new_page(); errors = []
        pg.on('pageerror', lambda e: errors.append(str(e)))
        pg.goto('http://clicker.test/clicker.html')
        pg.wait_for_function('window.Clicker?.state')
        good = pg.evaluate(SEED)

        # ---- 一、暫時狀態壞掉：直接進得了遊戲，還會告訴玩家修了什麼 ----
        broken = json.loads(good)
        broken['bossResult'] = {'scene':'nope','won':'yes','crack':9,'at':-1}
        pg.evaluate("(v)=>sessionStorage.setItem('test-seed',v)", json.dumps(broken))
        pg.reload(); pg.wait_for_function('!document.getElementById("tap").disabled', timeout=20000)
        state = pg.evaluate("""() => ({
          blocked:!document.getElementById('save-error').hidden,
          repaired:Clicker.store ? null : null,
          coins:Clicker.state.coins, click:Clicker.state.clickLevel,
          cards:Object.keys(Clicker.state.collection).length,
          badges:Clicker.state.badges, wins:Clicker.state.bossWins,
          notice:(window.__notices||[]).join(' | '),
          repaired:Clicker.repaired,
          backup:!!localStorage.getItem('clicker_save_broken'),
        })""")
        check(not state['blocked'], "壞掉的存檔不再擋住畫面，直接進得了遊戲")
        # 判準是「有沒有掉東西」，不是「有沒有變」——載入後被動收益就開始進帳、
        # 離線結算還會補發徽章，用等號的話會被遊戲正常運作弄成假失敗。
        check(state['coins'] >= 1e12 and state['click'] == 60 and state['cards'] == 51,
              f"養成進度全在：幣 {state['coins']:.3e}（>=1e12）／點擊等級 {state['click']}／卡 {state['cards']} 種")
        check(set(['pack10','pack25','boss-backyard']) <= set(state['badges'])
              and set(['backyard','kitchen']) <= set(state['wins']),
              f"徽章與王包勝利一個都沒掉：{state['badges']}／{state['wins']}")
        check(state['repaired'] and state['repaired']['applied'] == ['王包結算牌'],
              f"Clicker.repaired 說得出修了什麼：{state['repaired']}")
        # 浮動訊息 1.4 秒就自己收掉，錄得到就驗、錄不到不算失敗（上面那條才是真正的判準）
        if state['notice']:
            check('自動修好' in state['notice'], f"畫面上有告訴玩家：「{state['notice']}」")
        else:
            print('note 浮動訊息已經消失（1.4 秒），這次沒錄到，改看 Clicker.repaired')
        check(state['backup'], "壞掉的原檔有備份在 clicker_save_broken")
        pg.screenshot(path=str(OUT / 'r25-repaired.png'))

        # ---- 二、修不了的東西：照樣擋，而且錯誤畫面上要有救援入口（死循環的出口） ----
        dead = json.loads(good); dead['collection'] = {'nobody': 5}      # 身分資料壞掉，不在修復表裡
        pg.evaluate("()=>localStorage.removeItem('clicker_save_broken')")
        pg.evaluate("(v)=>sessionStorage.setItem('test-seed',v)", json.dumps(dead))
        pg.reload(); pg.wait_for_selector('#save-error:not([hidden])', timeout=20000)
        blocked = pg.evaluate("""() => ({
          text:document.getElementById('save-error-text').textContent,
          inert:document.getElementById('game-content').inert,
          rescueBtn:!!document.getElementById('rescue-open'),
          statsReachable:!document.getElementById('stats').hidden,
        })""")
        check('角色張數' in blocked['text'], f"修不了的就老實擋住：{blocked['text']}")
        check(blocked['inert'], "遊戲畫面照舊 inert（所以 #stats 裡的匯入鍵仍然按不到）")
        check(blocked['rescueBtn'], "錯誤畫面上有「貼上存檔救回」——死循環有出口了")

        # 真的走一次救援流程
        pg.locator('#rescue-open').click(); pg.wait_for_timeout(200)
        pg.locator('#rescue-text').fill(good)
        pg.locator('#rescue-load').click()
        pg.wait_for_function('!document.getElementById("tap").disabled', timeout=20000)
        after = pg.evaluate("""() => ({
          blocked:!document.getElementById('save-error').hidden,
          coins:Clicker.state.coins, cards:Object.keys(Clicker.state.collection).length,
        })""")
        check(not after['blocked'] and after['coins'] >= 1e12 and after['cards'] == 51,
              f"貼上好存檔就救回來了：幣 {after['coins']:.3e}／卡 {after['cards']} 種")
        pg.screenshot(path=str(OUT / 'r25-rescued.png'))

        # ---- 三、貼進去的那份自己也壞掉時，救援流程一樣會自動修 ----
        pg.evaluate("(v)=>sessionStorage.setItem('test-seed',v)",
                    json.dumps({**json.loads(good), 'collection': {'nobody': 5}}))
        pg.reload(); pg.wait_for_selector('#save-error:not([hidden])', timeout=20000)
        halfBroken = json.loads(good); halfBroken['daily'] = {'date':'亂碼','done':1,'need':-1,'dealt':99,'streak':'x'}
        pg.locator('#rescue-open').click(); pg.wait_for_timeout(200)
        pg.locator('#rescue-text').fill(json.dumps(halfBroken))
        pg.locator('#rescue-load').click()
        pg.wait_for_function('!document.getElementById("tap").disabled', timeout=20000)
        check(pg.evaluate("Clicker.state.coins") >= 1e12,
              "貼進去的那份也有小毛病時，救援流程會順手修好再讀進去")

        # ---- 四、好存檔不可以被誤判成要修 ----
        pg.evaluate("()=>{localStorage.removeItem('clicker_save_broken');}")
        pg.evaluate("(v)=>sessionStorage.setItem('test-seed',v)", good)
        pg.reload(); pg.wait_for_function('!document.getElementById("tap").disabled', timeout=20000)
        clean = pg.evaluate("""() => ({
          notice:(window.__notices||[]).join(' | '),
          repaired:Clicker.repaired,
          backup:!!localStorage.getItem('clicker_save_broken'),
        })""")
        check(clean['repaired'] is None, f"沒壞的存檔 Clicker.repaired 要是 null：{clean['repaired']}")
        check('自動修好' not in clean['notice'] and not clean['backup'],
              f"沒壞的存檔安安靜靜地載入，不會亂喊修過：「{clean['notice']}」")

        check(not errors, f"沒有 JS 錯誤：{errors}")
        print('截圖 _art/out/r25-repaired.png ／ r25-rescued.png')
        b.close()

    print()
    if fails:
        print(f'{len(fails)} 項未過：')
        for f in fails: print('  - ' + f)
        sys.exit(1)
    print('全部通過')

if __name__ == '__main__':
    main()

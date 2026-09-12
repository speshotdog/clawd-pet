# -*- coding: utf-8 -*-
"""第三十二輪驗收：直式手機的收尾。
  ·招募演出換成 560×900 的直box，五連排 2+3、五張都在畫面內（修好前有四張掉在畫面外）
  ·特效畫布跟著換座標系（否則特效跟卡片對不準）
  ·「選擇演出方式」在直式看得到（藏掉的話直式永遠換不了演出方式）
  ·招募頂欄在 390／320 都放得下、不折行
  ·卡冊在直式改單頁、面板抬頭不再被壓成直書
  ·入隊演出的頭貼飛在畫面內（#join-flight 直式改成全螢幕座標）
  ·橫式一切照舊
用法：PYTHONIOENCODING=utf-8 python tools/test/clicker-round32.py"""
import mimetypes, sys
from pathlib import Path
from urllib.parse import unquote, urlparse
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
SRC, OUT = ROOT / 'src', ROOT / '_art/out'
fails = []


def check(ok, msg):
    print(('ok   ' if ok else 'FAIL ') + msg)
    if not ok:
        fails.append(msg)


SEED = """() => { const S=ClickerSave, B=ClickerBalance, E=ClickerEconomy; const s=S.fresh(Date.now());
  const ids=Object.keys(B.characters);
  s.collection=Object.fromEntries(ids.map(i=>[i,5])); s.partnerLevels=Object.fromEntries(ids.map(i=>[i,40]));
  s.clickLevel=80; s.trainingLevel=20; s.coins=1e14; s.lifetimeCoins=1e15;
  s.manualClicks=50; s.claimedMilestones=['tutorial50'];
  s.marks=300; s.marksClaimed=900; s.markShop={slot4:true};
  s.skillSlots=['mieshi','qinghua','wanwumythic','zhenmu']; s.slotReadyAt=[0,0,0,0];
  s.owned={wardrobe:Object.entries(B.wardrobe).flatMap(([k,it])=>it.map(i=>k+':'+i.id))};
  s.settings.scene='backyard'; s.package=E.newPackage('backyard',30);
  S.validate(s,GachaPool); sessionStorage.setItem('test-seed',JSON.stringify(s)); }"""


def open_page(p, w, h, mobile):
    b = p.chromium.launch(headless=True)
    ctx = b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=2,
                        is_mobile=mobile, has_touch=mobile)

    def route(r):
        path = (SRC / unquote(urlparse(r.request.url).path).lstrip('/')).resolve()
        if not path.is_relative_to(SRC) or not path.is_file():
            r.fulfill(status=404, body='missing')
            return
        r.fulfill(body=path.read_bytes(),
                  content_type=mimetypes.guess_type(path)[0] or 'application/octet-stream')
    ctx.route('**/*', route)
    ctx.add_init_script("const s=sessionStorage.getItem('test-seed'); if(s){localStorage.setItem('clicker_save',s);sessionStorage.removeItem('test-seed');}")
    pg = ctx.new_page()
    errors = []
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.goto('http://clicker.test/clicker.html')
    pg.wait_for_function('window.Clicker?.state')
    pg.evaluate(SEED)
    pg.reload()
    pg.wait_for_function('!document.getElementById("tap").disabled')
    pg.wait_for_timeout(1400)
    return b, pg, errors


CARDS = """() => {
  const vw=innerWidth, vh=innerHeight;
  return [...document.querySelectorAll('#cards .card')].map(el => { const r=el.getBoundingClientRect();
    return {x:+r.left.toFixed(0), y:+r.top.toFixed(0), w:+r.width.toFixed(0), h:+r.height.toFixed(0),
            cx:+((r.left+r.right)/2).toFixed(0), cy:+((r.top+r.bottom)/2).toFixed(0),
            out: r.left<-1 || r.right>vw+1 || r.top<-1 || r.bottom>vh+1}; }); }"""


def draw_five(pg):
    pg.wait_for_function('!document.getElementById("draw-five").disabled', timeout=15000); pg.locator('#draw-five').click()   # v3：強存檔幾秒就過一隻小王，勝利演出那一下鍵會暫時鎖住
    pg.wait_for_timeout(1200)
    pg.locator('#reveal-all').click(timeout=15000)
    pg.wait_for_timeout(2600)


def main():
    OUT.mkdir(exist_ok=True)
    with sync_playwright() as p:
        # ─────────── 直式 390×844 ───────────
        b, pg, errors = open_page(p, 390, 844, True)
        check(pg.evaluate("()=>matchMedia('(max-aspect-ratio: 3/4)').matches"), '390×844 會切到直式版面')

        # 「選擇演出方式」是進招募層的唯一入口（演出下拉只長在招募層頂欄裡，pending 時還會拒絕變更）
        vis = pg.evaluate("()=>{const e=document.getElementById('recruit-open');const r=e.getBoundingClientRect();"
                          "return {display:getComputedStyle(e).display, w:+r.width.toFixed(0),"
                          " inRow:r.bottom<=document.querySelector('.recruit').getBoundingClientRect().bottom+1};}")
        check(vis['display'] != 'none' and vis['w'] > 30,
              '直式看得到「選擇演出方式」，否則永遠換不了演出：%s' % vis)
        check(vis['inRow'], '而且沒有溢出招募那一列（不折行）：%s' % vis)

        draw_five(pg)
        cards = pg.evaluate(CARDS)
        check(len(cards) == 5, '五連抽出五張卡：%d' % len(cards))
        check(all(not c['out'] for c in cards),
              '五張卡全部在畫面內（修好前有四張掉在畫面外）：出界 %d 張' % sum(c['out'] for c in cards))
        row1, row2 = cards[:2], cards[2:]
        check(max(c['cy'] for c in row1) < min(c['cy'] for c in row2),
              '排成 2+3：上排 y=%s、下排 y=%s' % ([c['cy'] for c in row1], [c['cy'] for c in row2]))
        box = pg.evaluate("""()=>{const f=document.getElementById('fx'), c=document.getElementById('cards');
          const fr=f.getBoundingClientRect(), cr=c.getBoundingClientRect();
          return {canvasW:f.width, canvasH:f.height, sameBox:Math.abs(fr.left-cr.left)<1&&Math.abs(fr.top-cr.top)<1
                  &&Math.abs(fr.width-cr.width)<1};}""")
        check(box['canvasW'] == 560 and box['canvasH'] == 900,
              '特效畫布換成直box 的 560×900（不換的話特效跟卡片對不準）：%dx%d' % (box['canvasW'], box['canvasH']))
        check(box['sameBox'], '特效層與卡片層疊在同一個框上')
        bar = pg.evaluate("""()=>{const t=document.getElementById('recruit-topbar'), tr=t.getBoundingClientRect();
          const out=[...t.children].filter(e=>{const r=e.getBoundingClientRect();
            if (!r.width && !r.height) return false;          // 網頁版隱藏的「關閉視窗」鍵
            return r.right>tr.right+1||r.left<tr.left-1||r.bottom>tr.bottom+1;}).map(e=>e.id||e.tagName);
          return {out, w:+tr.width.toFixed(0)};}""")
        check(not bar['out'], '招募頂欄放得下所有東西、沒有折行掉出去：%s' % bar)
        pg.screenshot(path=str(OUT / 'r32-portrait-gacha.png'))

        # 入隊演出：直式的 #join-flight 改成全螢幕座標，飛的頭貼要留在畫面內
        pg.locator('#collect').click()
        flight = []
        for _ in range(26):
            pg.wait_for_timeout(90)
            flight += pg.evaluate("""()=>[...document.querySelectorAll('.joining-portrait')].map(e=>{
              const r=e.getBoundingClientRect(); return {x:+r.left.toFixed(0),y:+r.top.toFixed(0),
                out:r.left<-40||r.right>innerWidth+40||r.top<-40||r.bottom>innerHeight+40};})""")
        check(len(flight) > 0, '收下之後真的有入隊演出在飛：取樣到 %d 幀' % len(flight))
        check(all(not f['out'] for f in flight),
              '飛行中的頭貼都留在畫面內（修好前照 960 座標算、會飛出畫面）：出界 %d 次' % sum(f['out'] for f in flight))

        # ─────────── 卡冊：直式單頁 ───────────
        pg.wait_for_timeout(1200)
        pg.locator('#roster-open').click()
        pg.wait_for_timeout(700)
        alb = pg.evaluate("""()=>{const L=document.getElementById('album-left'), R=document.getElementById('album-right');
          const h=document.querySelector('#roster h2').getBoundingClientRect();
          return {left:L.children.length, right:getComputedStyle(R).display, no:document.getElementById('album-page').textContent,
                  h2w:+h.width.toFixed(0), h2h:+h.height.toFixed(0),
                  out:[...L.querySelectorAll('.album-slot')].filter(e=>{const r=e.getBoundingClientRect();
                    return r.right>innerWidth||r.left<0||r.bottom>innerHeight;}).length};}""")
        check(alb['right'] == 'none' and alb['left'] == 4, '卡冊在直式是單頁 4 張、右頁收掉：%s' % alb)
        check(alb['no'].strip() == '1 / 13', '頁碼跟著改成單頁計數：%s' % alb['no'])
        check(alb['out'] == 0, '四張卡都在畫面內：出界 %d 張' % alb['out'])
        check(alb['h2w'] > alb['h2h'], '面板抬頭沒有被壓成直書（寬 %d > 高 %d）' % (alb['h2w'], alb['h2h']))
        pg.locator('#album-next').click()
        pg.wait_for_timeout(500)
        check(pg.eval_on_selector('#album-page', 'e=>e.textContent').strip() == '2 / 13', '單頁也翻得動')
        pg.screenshot(path=str(OUT / 'r32-portrait-album.png'))
        pg.locator('#roster-close').click()
        pg.wait_for_timeout(300)
        check(errors == [], '直式沒有 JS 錯誤：%s' % errors)
        b.close()

        # ─────────── 窄螢幕 320×640 ───────────
        b, pg, errors = open_page(p, 320, 640, True)
        draw_five(pg)
        cards = pg.evaluate(CARDS)
        check(len(cards) == 5 and all(not c['out'] for c in cards),
              '320 寬也是五張全部在畫面內：出界 %d 張' % sum(c['out'] for c in cards))
        bar = pg.evaluate("""()=>{const t=document.getElementById('recruit-topbar'), tr=t.getBoundingClientRect();
          return [...t.children].filter(e=>{const r=e.getBoundingClientRect();
            if (!r.width && !r.height) return false;
            return r.right>tr.right+1||r.bottom>tr.bottom+1;}).map(e=>e.id||e.tagName);}""")
        check(not bar, '320 寬的招募頂欄也沒有折行掉出去：%s' % bar)
        pg.screenshot(path=str(OUT / 'r32-narrow-gacha.png'))
        check(errors == [], '320 寬沒有 JS 錯誤：%s' % errors)
        b.close()

        # ─────────── 橫式沒被弄壞 ───────────
        b, pg, errors = open_page(p, 1280, 860, False)
        draw_five(pg)
        land = pg.evaluate("""()=>{const f=document.getElementById('fx');
          const cs=[...document.querySelectorAll('#cards .card')].map(e=>{const r=e.getBoundingClientRect();
            return +((r.top+r.bottom)/2).toFixed(0);});
          return {canvas:[f.width,f.height], ys:cs};}""")
        check(land['canvas'] == [960, 640], '橫式的特效畫布仍是 960×640：%s' % land['canvas'])
        check(max(land['ys']) - min(land['ys']) < 60, '橫式的五連仍是一排扇形（y 幾乎相同）：%s' % land['ys'])
        pg.locator('#collect').click()
        pg.wait_for_timeout(2600)
        pg.locator('#roster-open').click()
        pg.wait_for_timeout(700)
        wide = pg.evaluate("""()=>({left:document.getElementById('album-left').children.length,
          right:document.getElementById('album-right').children.length,
          no:document.getElementById('album-page').textContent})""")
        check(wide['left'] == 4 and wide['right'] == 4 and wide['no'].strip() == '1 / 7',
              '橫式的卡冊仍是跨頁 4+4：%s' % wide)
        check(errors == [], '橫式沒有 JS 錯誤：%s' % errors)
        b.close()

    print('\n截圖 _art/out/r32-portrait-gacha.png ／ r32-portrait-album.png ／ r32-narrow-gacha.png')
    print('\n全部通過' if not fails else '\n%d 條沒過：\n%s' % (len(fails), '\n'.join(fails)))
    sys.exit(1 if fails else 0)


main()

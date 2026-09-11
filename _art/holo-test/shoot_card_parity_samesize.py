# -*- coding: utf-8 -*-
"""受控卡面圖：同一張卡、同一個未變形寬度、中性姿態，在各入口各拍一張。

ORDER-2026-09-11-parity.md 要求「同尺寸完整卡面驗收」不能只有 computed style，
要有可以並排看的受控圖。這支沿用 check_card_parity.py 的同尺寸中性姿態做法。

用法：
    python shoot_card_parity_samesize.py [--card rocketdog] [--width 260] [--out DIR]
"""
from __future__ import annotations
import argparse, sys, io, json
from pathlib import Path

_OUT = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stdout = _OUT   # 留參考，否則 wrapper 被回收會變成 I/O on closed file
from playwright.sync_api import sync_playwright
from PIL import Image, ImageStat

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from check_card_parity import (ENTRIES, WALK, REFIT, FREEZE, SAMESIZE_JS,
                               activate, REACH_CARD, pull_batch)
from scope3_capture import SCOPE, artifact_hashes, digest, refit, tool_hashes
from scope3_layers import LAYER_JS, normalize_layers


def find_card(pg, card_id):
    return pg.evaluate("""(id)=>{
      const cs=[];(function w(r){r.querySelectorAll('.hcard').forEach(c=>cs.push(c));
        r.querySelectorAll('*').forEach(e=>{if(e.shadowRoot)w(e.shadowRoot)})})(document);
      const c=cs.find(x=>(x.dataset.id||'').replace(/^pool-/,'')===id && (window.__teamRole!=='detail' || (x.getRootNode().host||{}).id==='card-host')); 
      if(!c) return null; window.__shot=c; if(!c.hasAttribute('data-shot'))c.scrollIntoView({block:'center',behavior:'instant'});
      const r=c.getBoundingClientRect();
      return {x:r.x,y:r.y,w:r.width,h:r.height};
    }""", card_id)


ISOLATE = """()=>{
  const c=window.__shot;
  const roots=new Set();
  (function w(r){roots.add(r);r.querySelectorAll('*').forEach(e=>{if(e.shadowRoot)w(e.shadowRoot)})})(document);
  roots.forEach(r=>{const s=document.createElement('style');s.textContent='*{visibility:hidden !important} .hcard[data-shot],.hcard[data-shot] *{visibility:visible !important}';(r.head||r).appendChild(s)});
  c.dataset.shot='';
  c.style.setProperty('position','fixed','important');c.style.setProperty('left','40px','important');c.style.setProperty('top','40px','important');
  c.style.setProperty('margin','0','important');
  let e=c.parentElement || c.getRootNode().host;
  while(e){e.style.setProperty('overflow','visible','important');e=e.parentElement || e.getRootNode().host;}
  document.documentElement.style.background='#0e121a';document.body.style.background='#0e121a';
  getSelection().removeAllRanges();
}"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--viewport',default='1440x1200')
    ap.add_argument('--team-role',choices=['overview','detail'],default='overview')
    ap.add_argument('--compare',action='store_true')
    ap.add_argument('--determinism',type=Path)
    ap.add_argument('--entries', default=','.join(SCOPE))
    ap.add_argument('--root', default=str(HERE))
    ap.add_argument('--card', default='rocketdog')
    ap.add_argument('--width', type=int, default=260)
    ap.add_argument('--out', default=str(HERE.parent.parent / 'docs' / 'clicker' /
                                         'shots' / 'parity' / 'samesize'))
    args = ap.parse_args()
    out = Path(args.out); out.mkdir(parents=True, exist_ok=True)

    sys.path.insert(0, str(HERE))
    from pool_data import pool
    expected = {c['id']: c for c in pool()}
    fixture_cards = [expected[args.card]] if args.card in expected else []

    shots = []
    root=Path(args.root)
    hashes=artifact_hashes(root, exclude=out)
    evidence={'sourceHashes':hashes,'toolHashes':tool_hashes(),'cards':{},'errors':[],'teamRole':args.team_role}
    vw,vh=map(int,args.viewport.split('x'))
    names=args.entries.split(',')
    with sync_playwright() as pw:
        br = pw.chromium.launch()
        evidence.update(chromium=br.version,dpr=2,viewport={'width':vw,'height':vh})
        for name in names:
            cfg=ENTRIES[name]
            f = root / cfg['file']
            if not f.exists():
                raise FileNotFoundError(f)
            pg = br.new_page(viewport={'width': vw, 'height': vh}, device_scale_factor=2)
            try:
                pg.add_init_script(WALK)
                pg.goto(f.as_uri() + ('?ceremony-test' if cfg['surface'] == 'gacha' else ''))
                pg.evaluate(WALK)
                if cfg['surface']=='team': pg.evaluate('(r)=>window.__teamRole=r',args.team_role)
                act = activate(pg, cfg, [args.card], fixture_cards) if cfg['surface'] != 'gacha' else {}
                if cfg['surface'] == 'gacha':
                    err, _ = pull_batch(pg, fixture_cards)
                    if err:
                        print('%-24s 跳過：%s' % (name, err)); continue
                if cfg['surface'] == 'team':
                    pg.evaluate(REACH_CARD, args.card)
                    pg.wait_for_timeout(900)
                pg.evaluate(WALK); refit(pg, REFIT); pg.evaluate(FREEZE)
                if not find_card(pg, args.card):
                    print('%-24s 跳過：這個入口沒有 %s' % (name, args.card)); continue
                pg.evaluate(SAMESIZE_JS, args.width)
                pg.evaluate("()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))")
                pg.evaluate(ISOLATE)
                refit(pg, REFIT)
                pg.evaluate("""()=>{const c=window.__shot,r=c.getBoundingClientRect();
                  c.style.setProperty('left',(parseFloat(c.style.left)+40-r.x)+'px','important');
                  c.style.setProperty('top',(parseFloat(c.style.top)+40-r.y)+'px','important');}""")
                # 同尺寸之後版面會位移，要重新捲進可視區再量一次
                find_card(pg, args.card)
                pg.wait_for_timeout(300)
                box = find_card(pg, args.card)
                # 不裁切：卡片若沒有完整落在視窗內就跳過並講明，不要拍半張假裝有圖
                if (not box or box['w'] < 1 or box['h'] < 1 or box['x'] < 0 or box['y'] < 0
                        or box['x'] + box['w'] > vw or box['y'] + box['h'] > vh):
                    print('%-24s 跳過：同尺寸後沒有完整落在視窗內 %s' % (name, box)); continue
                p = out / ('%s-%s-%dpx.png' % (args.card, name, args.width))
                raw=pg.screenshot()
                im=Image.open(io.BytesIO(raw))
                crop=im.crop(tuple(round(v*2) for v in (box['x'],box['y'],box['x']+box['w'],box['y']+box['h'])))
                if crop.size != (args.width*2,round(args.width*7/5*2)) or ImageStat.Stat(crop.convert('L')).stddev[0] <= 8:
                    raise RuntimeError('blank or incorrectly sized card capture')
                crop.save(p)
                shots.append((name, p))
                evidence['cards'][name]={'box':box,'sha256':digest(p),'path':str(p),
                    'layers':normalize_layers(pg.evaluate('()=>('+LAYER_JS+')(window.__shot)')),
                    'diagnostics':pg.evaluate('()=>window.__captureDiagnostics || []')} 
                print('%-24s %.1f×%.1f -> %s' % (name, box['w'], box['h'], p.name))
            except Exception as e:
                evidence['errors'].append({'entry':name,'error':str(e)})
                print('%-24s 失敗：%s' % (name, str(e)[:120]))
            finally:
                pg.close()
        br.close()

    if shots:
        ims = [Image.open(p) for _, p in shots]
        w = sum(i.width for i in ims) + 8 * (len(ims) - 1)
        h = max(i.height for i in ims)
        sheet = Image.new('RGBA', (w, h), (14, 18, 26, 255))
        x = 0
        for i in ims:
            sheet.paste(i, (x, 0)); x += i.width + 8
        p = out / ('%s-all-entries-%dpx.png' % (args.card, args.width))
        sheet.save(p)
        print('\n並排圖：%s（%d 個入口）' % (p, len(ims)))
    evidence['artifactsUnchanged']=hashes==artifact_hashes(root, exclude=out)
    if args.compare:
        import numpy as np
        gate=args.determinism or HERE.parents[1]/'docs/clicker/shots/scope3/determinism'/(args.card+'-result.json')
        g=json.loads(gate.read_text(encoding='utf-8'))
        if not (g.get('pass') is True and g.get('sourceHashes')==hashes and g.get('toolHashes')==tool_hashes()
                and set(names)<=set(g.get('entries',{}))):
            raise RuntimeError('repeatability gate missing, failed, stale, or incomplete')
        reference=next((p for n,p in shots if n=='gacha-test'),None)
        if reference is None: raise RuntimeError('missing gacha-test pixel reference')
        a=np.asarray(Image.open(reference).convert('RGB')).astype(int)
        pixel={}
        for name,path in shots:
            b=np.asarray(Image.open(path).convert('RGB')).astype(int)
            if a.shape!=b.shape: raise RuntimeError('pixel dimensions differ')
            delta=np.abs(a-b).max(axis=2)
            luminance_std=ImageStat.Stat(Image.open(path).convert('L')).stddev[0]
            pixel[name]={'mean':float(delta.mean()),'max':int(delta.max()),'fractionOver32':float((delta>32).mean()),
                         'luminanceStandardDeviation':luminance_std,'pass':bool(delta.mean()<1.0 and (delta>32).mean()<0.01 and luminance_std>8)}
        evidence['pixelComparison']={'threshold':'mean(max RGB error) < 1.0; fraction >32 < 1%; nonblank std >8',
                                     'reference':'gacha-test','results':pixel,'pass':all(v['pass'] for v in pixel.values())}
        for name,v in pixel.items(): print('PIXEL',name,'mean',v['mean'],'PASS' if v['pass'] else 'FAIL')
    (out / (args.card+'-capture.json')).write_text(json.dumps(evidence,ensure_ascii=False,indent=2),encoding='utf-8')
    return 0 if len(shots)==len(names) and not evidence['errors'] and evidence['artifactsUnchanged'] and evidence.get('pixelComparison',{}).get('pass',True) else 1


if __name__ == '__main__':
    sys.exit(main())

# 第四十一輪：素材入庫與來源解析

**尚未完成第二節的「只有repo也能重建」验收。**

先讀完BRIEF-holo-round41.md；其〇節是起因說明，沒有reading list。修改前另讀第三十二輪與第四十輪報告及相關來源程式。只修改本worktree，未commit、push或引入LFS，桌面原檔未移動、改名、刪除或重新編碼。

## 阻擋事項

使用者明確要求「Work only inside this git worktree」，簡報第二節要求暫時改名worktree外的桌面素材。已詢問是否允許四個外部來源暫時改名並復原，尚未收到答覆。因此沒有執行改名，亦沒有把桌面仍存在的測試冒充指定驗收。

| 原路徑 | 擬暫時改名路徑 | 實際狀態 |
|---|---|---|
| `C:/Users/spesh/OneDrive/Desktop/4.0` | `C:/Users/spesh/OneDrive/Desktop/4.0__hidden_round41` | 未改名 |
| `C:/Users/spesh/OneDrive/Desktop/mtk1.mov` | `C:/Users/spesh/OneDrive/Desktop/mtk1__hidden_round41.mov` | 未改名 |
| `C:/Users/spesh/OneDrive/Desktop/mtk2.mov` | `C:/Users/spesh/OneDrive/Desktop/mtk2__hidden_round41.mov` | 未改名 |
| `C:/Users/spesh/OneDrive/Desktop/IMG_1820.png` | `C:/Users/spesh/OneDrive/Desktop/IMG_1820__hidden_round41.png` | 未改名 |

## 素材清單

共23檔、71,112,213 bytes：禮物3檔、4.0原圖16檔、怪物4檔。複製前逐檔執行`git check-ignore -v -- <repo路徑>`，exit 1，stdout／stderr空白，表示沒有忽略。複製後來源與副本SHA-256全部一致。表中SHA為兩者共同值，大小單位bytes。

| repo路徑 | 大小 | SHA-256 | check-ignore |
|---|---:|---|---|
| `_art/holo-test/gift/source/mtk1.mov` | 34612715 | `aac030315d94400106258df7a5f779380f57972397f0164fbfaf6cce3fbcd5c4` | exit 1，無輸出 |
| `_art/holo-test/gift/source/mtk2.mov` | 27911682 | `2fcc278d7d074f604eec67232ccd7101f1fa8ad0f2cc1ff7049459f3eca49e2d` | exit 1，無輸出 |
| `_art/holo-test/gift/source/IMG_1820.png` | 98599 | `1556363574e5eabc8da6a1f31340b3f7097bfd248a029e209e432cf56bba4785` | exit 1，無輸出 |
| `_art/holo-test/source-4.0/今天我生日 傳說.jpg` | 27921 | `0f267ed73cb23a9002f0a10a8acdf9ec8ccdf83f7abc94ad4846173bfeceb306` | exit 1，無輸出 |
| `_art/holo-test/source-4.0/咩噗熊 精良.png` | 36488 | `1c64f9fc559df4080fec8ac69eea86c508e064214dc1d70a8cfb824ed5002dde` | exit 1，無輸出 |
| `_art/holo-test/source-4.0/外送咩鴿 精良.png` | 105233 | `d60bf0d81f150d1368847d91a0c41df4d4f1423b8da97c81b00021fd24853859` | exit 1，無輸出 |
| `_art/holo-test/source-4.0/小丑玥 史詩.png` | 74693 | `ff62db5a291fce91d913772cb7b741f55f828ca82b6140261548c40186c4c343` | exit 1，無輸出 |
| `_art/holo-test/source-4.0/小膠膠 史詩.png` | 45649 | `56a0c95582a5cb7fbc0ee5bb5b44e6ab53594292eb31f9fc9798ecd07b6f799c` | exit 1，無輸出 |
| `_art/holo-test/source-4.0/成體熱狗 史詩.png` | 60914 | `faef4d9d4851a073a2d5fab37405203e5fce9a584592d48c82fdd5fa8db1ca52` | exit 1，無輸出 |
| `_art/holo-test/source-4.0/扁扁彩華 史詩.png` | 51885 | `a3022f556241cdc0fa6a751fcbaa2e1eec7dd36d18191d27828dcf3dac420a2c` | exit 1，無輸出 |
| `_art/holo-test/source-4.0/普發玥玥 精良.png` | 33881 | `0ea160885542733407a46cfdd2668671c0aa2f417fd9d647d715867efeecb777` | exit 1，無輸出 |
| `_art/holo-test/source-4.0/沙堡領主 神話.png` | 139517 | `380549b28051b05f38a6119ee4eed94b4b5e315bb570cb6fdb44e8254bd6464a` | exit 1，無輸出 |
| `_art/holo-test/source-4.0/流浪玥手 神話.png` | 150097 | `f948df128e6ce778da76f48a9974b52677e9d3f51b93da581e938c416b18b001` | exit 1，無輸出 |
| `_art/holo-test/source-4.0/玥熊 史詩.png` | 38757 | `bb5631808bc127dee9d76659b709f9e65b2734f406e697bfe56bfa9df40049f9` | exit 1，無輸出 |
| `_art/holo-test/source-4.0/珍氣球 神話.png` | 213860 | `5aa146ff2e9e6bd01e46c83b6ccd09fc917026380dccdcbbecd58dd6beca75fb` | exit 1，無輸出 |
| `_art/holo-test/source-4.0/珍珍 神話.png` | 6403612 | `96dd45fcd30544f8a788a17747d5ff43c61e55dba713ab0fd445be1bf65ea729` | exit 1，無輸出 |
| `_art/holo-test/source-4.0/真菌玥 神話.png` | 328441 | `8d6448863958cc82ee013644b712ce3d2058a1722d3a32499d76cd80eb95b4f6` | exit 1，無輸出 |
| `_art/holo-test/source-4.0/給咩錢好嗎 史詩.png` | 44708 | `bc39aeb13b7ad92451f7419c32434dbc0958f18cf739b102cd42d8a1f8389073` | exit 1，無輸出 |
| `_art/holo-test/source-4.0/膠齒 精良.png` | 49948 | `0805cbc4cf73d1b4c3e6be193c160c47931f348e9437a990e74a416442309224` | exit 1，無輸出 |
| `_art/holo-test/source-4.0/怪物/01.gif` | 14299 | `c0b60973e567658f5d69eae170c9806e385615cf80c884847caab30f0c87fec0` | exit 1，無輸出 |
| `_art/holo-test/source-4.0/怪物/ej93j4.gif` | 130870 | `f06bc4080f9fa4687f86b33fd574df60b59c989458a6d441ba9f14c5e8eddf8f` | exit 1，無輸出 |
| `_art/holo-test/source-4.0/怪物/image.gif` | 468144 | `197d05af5408cd9661c20f0f9938bfd70c920c4a7ec0911c4c46ae07a230c3f7` | exit 1，無輸出 |
| `_art/holo-test/source-4.0/怪物/rise.png` | 70300 | `0f24e47227b4e63512679df6c4f96c78daf9be0f31627f052d1cf9e551911571` | exit 1，無輸出 |

完整資料：[source-inventory.json](shots/round41/source-inventory.json)。MOV原始位元組保持一致。

## 來源解析

`build_gift_card.py`依完整三檔集合選擇`gift/source`、`Path.home()/OneDrive/Desktop`、`HOLO_GIFT_SOURCE`。`--page-only`仍不要求原始影片。

`prepare_round32.py`依完整16張原圖選擇`source-4.0`、`Path.home()/OneDrive/Desktop/4.0`、`HOLO_SOURCE_4_0`、相容舊`HOLO_SOURCE`。每張須恰有一個匹配檔案；候選缺檔或歧義就找下一組，全部失敗則退出並列出所有嘗試路徑。環境變數按簡報規定作最後備援，不蓋過完整repo來源。移除寫死的使用者路徑。

第四十輪`prepare_round40.py`既有的匯入方式會共用新解析，不必改圖像處理演算法。怪物檔只保存，不新增卡池用途。

以下diff相對開工檔案，排除原有dirty變更：

```diff
--- build_gift_card.py (round41 before)
+++ build_gift_card.py (round41 after)
@@ -21,16 +21,26 @@
 """
 from base64 import b64encode
 from pathlib import Path
-import io, json, re, subprocess, sys
+import io, json, os, re, subprocess, sys
 import numpy as np
 from PIL import Image
 
-HERE = Path(__file__).parent
+HERE = Path(__file__).resolve().parent
 GIFT = HERE / 'gift'
 GIFT.mkdir(exist_ok=True)
-DESK = Path.home() / 'OneDrive/Desktop'
-BG_SRC = DESK / 'IMG_1820.png'
-MOV_SRC = {'idle': DESK / 'mtk1.mov', 'alt': DESK / 'mtk2.mov'}
+def resolve_source():
+    candidates = [GIFT / 'source', Path.home() / 'OneDrive/Desktop']
+    if os.environ.get('HOLO_GIFT_SOURCE'):
+        candidates.append(Path(os.environ['HOLO_GIFT_SOURCE']).expanduser())
+    tried = []
+    for folder in candidates:
+        missing = [name for name in ('IMG_1820.png', 'mtk1.mov', 'mtk2.mov')
+                   if not (folder / name).is_file()]
+        if not missing:
+            print('Gift source: %s' % folder)
+            return folder
+        tried.append('%s (missing: %s)' % (folder, ', '.join(missing)))
+    sys.exit('No complete gift source set. Searched:\n' + '\n'.join(tried))
 
 CARD = (600, 840)          # 場景卡的畫布，兩層都用這個尺寸
 SUBJ_WIDTH = 0.98          # 角色寬度佔卡寬。1.2 倍會超過卡寬、翅膀被裁掉（使用者說
@@ -117,9 +127,9 @@
 
 # Page-only rebuilds keep the already approved gift artwork byte-identical.
 if '--page-only' not in sys.argv:
-    for p in (BG_SRC, *MOV_SRC.values()):
-        if not p.exists():
-            sys.exit('missing source: %s' % p)
+    source_dir = resolve_source()
+    BG_SRC = source_dir / 'IMG_1820.png'
+    MOV_SRC = {'idle': source_dir / 'mtk1.mov', 'alt': source_dir / 'mtk2.mov'}
 
     bg, bg_src_size = build_background()
     bg_path = GIFT / 'layer-mohuashaonv-background.png'
--- prepare_round32.py (round41 before)
+++ prepare_round32.py (round41 after)
@@ -8,11 +8,28 @@
 import bright_edge
 
 HERE=Path(__file__).resolve().parent
-SOURCE_CANDIDATES=[Path(r'C:\Users\spesh\OneDrive\Desktop\4.0'), Path(r'C:\Users\ASUS User VII\Desktop\新卡\4.0')]
-SOURCE=Path(os.environ['HOLO_SOURCE']) if os.environ.get('HOLO_SOURCE') else next((p for p in SOURCE_CANDIDATES if p.is_dir()), SOURCE_CANDIDATES[0])
 OUT=HERE.parents[1]/'docs/clicker/shots/round32'
 RARITY={'rare':'精良','epic':'史詩','legendary':'傳說','mythic':'神話'}
 CROSS=nd.generate_binary_structure(2,1)
+
+def resolve_source():
+    candidates=[HERE/'source-4.0', Path.home()/'OneDrive/Desktop/4.0']
+    for key in ('HOLO_SOURCE_4_0','HOLO_SOURCE'):
+        if os.environ.get(key):candidates.append(Path(os.environ[key]).expanduser())
+    tried=[]
+    for folder in candidates:
+        invalid=[]
+        for c in EXTRA_CARDS:
+            pattern=c['name']+' '+RARITY[c['rarity']]+'.*'
+            matches=[p for p in folder.glob(pattern) if p.is_file()]
+            if len(matches)!=1:invalid.append('%s (%d matches)' % (pattern,len(matches)))
+        if not invalid:
+            print('4.0 source: %s' % folder)
+            return folder
+        tried.append('%s (missing or ambiguous: %s)' % (folder,', '.join(invalid)))
+    raise SystemExit('No complete 4.0 source set. Searched:\n'+'\n'.join(tried))
+
+SOURCE=resolve_source()
 
 def edge_connected(mask):
     seed=np.zeros_like(mask);seed[0]=mask[0];seed[-1]=mask[-1];seed[:,0]=mask[:,0];seed[:,-1]=mask[:,-1]
```

## 真實檢查結果

| 已執行項目 | exit code | 結果 |
|---|---:|---|
| 複製／hash／ignore檢查的Python程序 | 0 | 23檔一致，未忽略 |
| 兩支resolver隔離測試程序 | 0 | repo優先、桌面備援、環境備援、缺檔拒絕、錯誤列出路徑 |
| 指定交付檔案git add | 0 | 已stage，未commit |
| index／保護檔檢查程序 | 0 | 46項交付檔有index紀錄；382個保護檔hash未變 |
| git diff --check | 0 | 無輸出 |

Resolver測試只在worktree內建立臨時素材並執行原解析函式，不是第二節驗收的替代品。證據：[resolver-checks.json](shots/round41/resolver-checks.json)、[protected-check.json](shots/round41/protected-check.json)。

以下指定順序**尚未執行，沒有exit code**。共同命令前綴為`python _art/holo-test/`：

1. `build_gift_card.py`
2. `prepare_round32.py`
3. `prepare_round40.py`（補齊三張depth並沿用第四十輪framed輸出）
4. `build_card_scenes.py`
5. `embed_masks.py`
6. `build_cards_remade.py`
7. `build_cards_remade_standalone.py`
8. `build_deluxe_b.py`
9. `build_deluxe_b_standalone.py`
10. `check_gift_card.py --tag round41`
11. `check_gift_perf.py --tag round41`
12. `check_demo_round8.py`
13. `check_demo_round9.py`
14. `check_gacha_card_regression.py`
15. `check_gacha_followup.py`
16. `check_bright_edge.py`

重建前SHA：[products-before.json](shots/round41/products-before.json)。尚未重建，前後SHA是否一致沒有結論。第四十輪曾記錄gift效能失敗，不能將歷史結果當成本輪退出碼；本輪未改驗收門檻。

## 版控與原有工作

來源23檔、gift衍生6檔、第四十輪双層6檔、gift／gallery／deluxe頁面與必要builder已stage。[46項交付清單](shots/round41/indexed-deliverables.json)包含路徑與SHA。沒有一律stage整個dirty worktree；不相關舊輪次untracked檔仍保留。指定HTML與prepare_round32原有變更隨完整檔案stage，沒有撤銷它們。

[開工git狀態](shots/round41/initial-status.txt)保存原有變更。`card_face.js`、`pool_data.py`及`src/`共382檔與開工hash完全一致。

以下是交付時`git status --porcelain`完整輸出：

```text
 M _art/holo-test/art/card-bianbiancaihua.png
 M _art/holo-test/art/card-chengtiregou.png
 M _art/holo-test/art/card-geimieqianhaoma.png
 M _art/holo-test/art/card-jiaochi.png
 M _art/holo-test/art/card-jintianwoshengri.png
 M _art/holo-test/art/card-liulangyueshou.png
 M _art/holo-test/art/card-miepuxiong.png
 M _art/holo-test/art/card-pufayueyue.png
 M _art/holo-test/art/card-waisongmiege.png
 M _art/holo-test/art/card-xiaochouyue.png
 M _art/holo-test/art/card-xiaojiaojiao.png
 M _art/holo-test/art/card-yuexiong.png
 M _art/holo-test/art/palette.json
A  _art/holo-test/bright_edge.py
 M _art/holo-test/build_card_scenes.py
A  _art/holo-test/build_gift_card.py
M  _art/holo-test/cards-remade-standalone.html
M  _art/holo-test/cards-remade.html
 M _art/holo-test/ceremony-background.svg
 M _art/holo-test/ceremony-fx.js
 M _art/holo-test/ceremony-layout.js
 M _art/holo-test/ceremony.css
 M _art/holo-test/check_gacha_audio_round30.py
 M _art/holo-test/check_gacha_followup.py
 M _art/holo-test/check_gacha_layers_round33.py
A  _art/holo-test/check_gift_masks.py
A  _art/holo-test/check_gift_perf.py
 M _art/holo-test/check_new_cards_round32.py
 M _art/holo-test/check_ui_round33.py
M  _art/holo-test/deluxe-gacha-b-standalone.html
M  _art/holo-test/deluxe-gacha-b-test-standalone.html
M  _art/holo-test/deluxe-gacha-b-test.html
M  _art/holo-test/deluxe-gacha-b.html
 M _art/holo-test/demo.html
 M _art/holo-test/embed_masks.py
A  _art/holo-test/gift-mohuashaonv.html
A  _art/holo-test/gift/layer-mohuashaonv-alt-mask.webp
A  _art/holo-test/gift/layer-mohuashaonv-alt.webp
A  _art/holo-test/gift/layer-mohuashaonv-background.png
A  _art/holo-test/gift/layer-mohuashaonv-idle-mask.webp
A  _art/holo-test/gift/layer-mohuashaonv-idle.webp
A  _art/holo-test/gift/manifest.json
A  _art/holo-test/gift/source/IMG_1820.png
A  _art/holo-test/gift/source/mtk1.mov
A  _art/holo-test/gift/source/mtk2.mov
A  _art/holo-test/layer-shabaolingzhu-background.png
A  _art/holo-test/layer-shabaolingzhu-subject.png
A  _art/holo-test/layer-zhenjunyue-background.png
A  _art/holo-test/layer-zhenjunyue-subject.png
A  _art/holo-test/layer-zhenqiqiu-background.png
A  _art/holo-test/layer-zhenqiqiu-subject.png
 M _art/holo-test/pool_data.py
M  _art/holo-test/prepare_round32.py
A  _art/holo-test/prepare_round40.py
A  "_art/holo-test/source-4.0/\344\273\212\345\244\251\346\210\221\347\224\237\346\227\245 \345\202\263\350\252\252.jpg"
A  "_art/holo-test/source-4.0/\345\222\251\345\231\227\347\206\212 \347\262\276\350\211\257.png"
A  "_art/holo-test/source-4.0/\345\244\226\351\200\201\345\222\251\351\264\277 \347\262\276\350\211\257.png"
A  "_art/holo-test/source-4.0/\345\260\217\344\270\221\347\216\245 \345\217\262\350\251\251.png"
A  "_art/holo-test/source-4.0/\345\260\217\350\206\240\350\206\240 \345\217\262\350\251\251.png"
A  "_art/holo-test/source-4.0/\346\200\252\347\211\251/01.gif"
A  "_art/holo-test/source-4.0/\346\200\252\347\211\251/ej93j4.gif"
A  "_art/holo-test/source-4.0/\346\200\252\347\211\251/image.gif"
A  "_art/holo-test/source-4.0/\346\200\252\347\211\251/rise.png"
A  "_art/holo-test/source-4.0/\346\210\220\351\253\224\347\206\261\347\213\227 \345\217\262\350\251\251.png"
A  "_art/holo-test/source-4.0/\346\211\201\346\211\201\345\275\251\350\217\257 \345\217\262\350\251\251.png"
A  "_art/holo-test/source-4.0/\346\231\256\347\231\274\347\216\245\347\216\245 \347\262\276\350\211\257.png"
A  "_art/holo-test/source-4.0/\346\262\231\345\240\241\351\240\230\344\270\273 \347\245\236\350\251\261.png"
A  "_art/holo-test/source-4.0/\346\265\201\346\265\252\347\216\245\346\211\213 \347\245\236\350\251\261.png"
A  "_art/holo-test/source-4.0/\347\216\245\347\206\212 \345\217\262\350\251\251.png"
A  "_art/holo-test/source-4.0/\347\217\215\346\260\243\347\220\203 \347\245\236\350\251\261.png"
A  "_art/holo-test/source-4.0/\347\217\215\347\217\215 \347\245\236\350\251\261.png"
A  "_art/holo-test/source-4.0/\347\234\237\350\217\214\347\216\245 \347\245\236\350\251\261.png"
A  "_art/holo-test/source-4.0/\347\265\246\345\222\251\351\214\242\345\245\275\345\227\216 \345\217\262\350\251\251.png"
A  "_art/holo-test/source-4.0/\350\206\240\351\275\222 \347\262\276\350\211\257.png"
 M docs/clicker/ISSUES-2026-09-09-night.md
A  docs/clicker/REPORT-holo-round41.md
 M docs/clicker/shots/round33/acceptance.json
 M docs/clicker/shots/round33/contact-sheet-63.jpg
 M docs/clicker/shots/round33/quality-checked.json
 M docs/clicker/shots/round33/retained/demo/verification-round8.json
 M docs/clicker/shots/round33/retained/demo/verification-round9.json
A  docs/clicker/shots/round41/build_gift_card.py.before
A  docs/clicker/shots/round41/delivery-paths.json
A  docs/clicker/shots/round41/diff-check.txt
A  docs/clicker/shots/round41/indexed-deliverables.json
A  docs/clicker/shots/round41/initial-status.txt
A  docs/clicker/shots/round41/prepare_round32.py.before
A  docs/clicker/shots/round41/products-before.json
A  docs/clicker/shots/round41/protected-before.json
A  docs/clicker/shots/round41/protected-check.json
A  docs/clicker/shots/round41/resolver-checks.json
A  docs/clicker/shots/round41/source-inventory.json
A  docs/clicker/shots/round41/source-resolution.diff
?? _art/holo-test/build_mtk_art.py
?? _art/holo-test/build_mtk_card.py
?? _art/holo-test/check_acceptance_round34.py
?? _art/holo-test/check_background_mean_round34.py
?? _art/holo-test/check_bright_edge.py
?? _art/holo-test/check_depth_round40.py
?? _art/holo-test/check_epic_cause_round34.py
?? _art/holo-test/check_gacha_round34.py
?? _art/holo-test/check_gift_card.py
?? _art/holo-test/check_glow_candidates_round34.py
?? _art/holo-test/check_gpu_timing_round34.py
?? _art/holo-test/check_mtk_card.py
?? _art/holo-test/check_retained_round34.py
?? _art/holo-test/check_wave_coverage_round34.py
?? _art/holo-test/mtk-card.html
?? _art/holo-test/mtk/
?? _art/holo-test/run_checks_round40.py
?? _art/holo-test/shots/gift-alt.png
?? _art/holo-test/shots/gift-dev.png
?? _art/holo-test/shots/gift-flat.png
?? _art/holo-test/shots/gift-idle.png
?? _art/holo-test/shots/gift-moved-copy.png
?? _art/holo-test/shots/gift-tilt.png
?? _art/holo-test/shots/mtk-dev-normal.png
?? _art/holo-test/shots/mtk-dev-special-late.png
?? _art/holo-test/shots/mtk-dev-special.png
?? _art/holo-test/shots/mtk-dev-tilt.png
?? _art/holo-test/shots/mtk-moved-copy-normal.png
?? _art/holo-test/shots/mtk-moved-copy-special.png
?? _art/holo-test/shots/mtk-standalone-copy-normal.png
?? _art/holo-test/shots/mtk-standalone-copy-special.png
?? _art/holo-test/verification-bright-edge.json
?? _art/holo-test/verification-gift.json
?? _art/holo-test/verification-mtk.json
?? _art/holo-test/write_report_round34.py
?? _art/holo-test/write_report_round40.py
?? docs/clicker/BRIEF-holo-round34.md
?? docs/clicker/BRIEF-holo-round35.md
?? docs/clicker/BRIEF-holo-round36.md
?? docs/clicker/BRIEF-holo-round37.md
?? docs/clicker/BRIEF-holo-round38.md
?? docs/clicker/BRIEF-holo-round39.md
?? docs/clicker/BRIEF-holo-round40.md
?? docs/clicker/BRIEF-holo-round41.md
?? docs/clicker/PLAN-round36-depth.md
?? docs/clicker/REPORT-holo-round34.md
?? docs/clicker/REPORT-holo-round35.md
?? docs/clicker/REPORT-holo-round36.md
?? docs/clicker/REPORT-holo-round37.md
?? docs/clicker/REPORT-holo-round38.md
?? docs/clicker/REPORT-holo-round39.md
?? docs/clicker/REPORT-holo-round40.md
?? docs/clicker/shots/round33/retained/retained30/regression/followup.json
?? docs/clicker/shots/round33/retained/retained30/regression/sizing.json
?? docs/clicker/shots/round34/
?? docs/clicker/shots/round35/
?? docs/clicker/shots/round36/
?? docs/clicker/shots/round37/
?? docs/clicker/shots/round38/
?? docs/clicker/shots/round39/
?? docs/clicker/shots/round40/
```

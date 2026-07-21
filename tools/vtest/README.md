# vtest — 實機管線驗證台

桌寵部件接縫的**實機管線**驗證工具。過去所有驗證都在 PIL、原圖尺度、不透明合成的世界做，
抓不到實機（Chromium/WebView2 的 SVG 光柵化、縮到 CSS×dpr、每層邊緣有 AA 半透明像素、
兩層深色邊緣重疊半透明疊加變更黑）才出現的黑線／破圖。這個驗證台**走真 Chromium(Skia)
的 SVG 光柵化到實體尺度**，用三關把缺陷抓出來。

## 三關
1. **指標 (metrics.py)** — 對每個部件的角度掃描與 0° 比對，量：
   - `blackline` 黑線：兩層都不透明、θ 顯著比 0° 暗且本身夠暗（深對深半透明疊加變更黑）。**本次新指標，PIL 抓不到。**
   - `gap` 缺口：θ 出現被剪影包住的透明像素（背景色跑進剪影＝破圖）。
   - `ghost` 殘影：0° 是明亮毛色、θ 變深色的孤兒塊。
2. **Gemini 視覺判官 (judge.py)** — 把原始渲染條帶（不含 heatmap）送 gemini-2.5-flash，中文提示指出肉眼可見缺陷；乾淨回 PASS。
3. **人審條帶** — `out/strip_<char>_<part>.png`，上列原始渲染、下列紅=變暗/藍=缺口 heatmap，2x 放大。

## 合格判準（實測校準）
- 乾淨對照 **dog** 全 PASS：blackline_maxcomp ≤ 64、gap_maxcomp ≤ 44。
- 判缺陷門檻：`blackline_maxcomp ≥ 150` 或 `gap_maxcomp ≥ 100` → FAIL。
- 修復前實測（證據）：jiaobu/pawR blackline_maxcomp 205–862（黑線），yueyue/tail 409–557（破圖），
  兩者皆遠超門檻 → 成功重現使用者回報的兩個退化。

## 怎麼跑
需要三個東西：**page 伺服器**（repo root）、**收檔伺服器**、**瀏覽器**。

```powershell
# 1. page/資產伺服器（repo root，讓 /src/*.png 與 /tools/vtest/vtest.html 同源）
python -m http.server 17998 --directory D:\claude\clawd-pet
# 2. 收檔伺服器（canvas dataURL POST 進 out/）
python D:\claude\clawd-pet\tools\vtest\recv_server.py 17997
```

3. 瀏覽器開 `http://localhost:17998/tools/vtest/vtest.html`（**必須 http 同源，不能 file://**，
   否則 fetch /src 會被擋）。在 console / Browser pane 呼叫：
```js
await window.VT.scan('jiaobu', [
  {tag:'0',    part:'pawR', pivot:[533,452], deg:0},
  {tag:'p11',  part:'pawR', pivot:[533,452], deg:11},
]);   // 每個 frame 存成 out/<char>_<part>_<tag>.png
```
   角度掃描表 = 依 pet.js animate() 的擺幅推出（pawR 走路±5.5°/ask+14.5°/hi±11°、
   tail±5°、legR 走路±6.5°；yueyue tail 樞紐 [608,385]±5°）。`VT_CFG` 內各角色顯示高度取自
   `CHAR_CFG`，物理尺度 = height × 1.875(dpr)。

4. 指標＋條帶：
```powershell
python metrics.py jiaobu pawR n11,n5_5,0,p5_5,p11,p14_5
python judge.py            # Gemini 判所有預設 GROUPS（key 從 D:\claude\.env 載入）
```

## 重要限制
- **背景分頁 rAF 不跑、CSS 動畫凍結** → 管線全同步（setAttribute + await img.decode() + drawImage），不依賴動畫。
- data-URL SVG 載不到相對路徑 PNG → 每個 PNG 先 fetch 同源轉 data URL 內嵌。
- 改任何資產後**一律重跑全部件×全角度**三關（body 是共用底）。

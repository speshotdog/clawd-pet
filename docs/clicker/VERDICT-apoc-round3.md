已唯讀檢查指定差異與兩個未追蹤檔案；未修改檔案。`npm.cmd test`：**203 項全過**。以下依原始碼及記憶體內重現判定，未實跑 GUI 截圖驗收。

**必修**

1. **換弱隊仍可大幅壓低券價。**  
   位置：[clicker-apoc-ui.js:319](/D:/claude研究/clawd-pet-v3/src/clicker-apoc-ui.js:319)、[clicker-stage.js:148](/D:/claude研究/clawd-pet-v3/src/clicker-stage.js:148)。  
   重現：桌邊每秒收益達 `9e10` 時，紀錄只存 `peakRateStamp=10`；保留金幣、換弱隊，再進末世換券。實測首張價格由 `5.4e13` 降至 `6e12`，只剩九分之一。  
   建議：另存精確的歷史最高收益，定價取它與當下收益的最大值。若要求跨桌布保留，不能沿用會被重置的 `peakRateStamp`。

2. **末世商店按 Esc 可能重畫桌邊商店。**  
   位置：[clicker-album.js:599](/D:/claude研究/clawd-pet-v3/src/clicker-album.js:599)、[clicker-apoc-ui.js:341](/D:/claude研究/clawd-pet-v3/src/clicker-apoc-ui.js:341)。  
   重現：桌邊開商店→進「特效」分類→直接按返回關閉商店→切末世→開末世商店→按 Esc。舊 `shopCategory` 尚在，實際呼叫桌邊 `renderWardrobe()`，沒有關閉末世商店。  
   建議：`escape()` 先按世界分流；末世直接關閉面板，不進桌邊分類返回邏輯。

**值得修**

1. **粒子共用全域畫布，仍會串到另一層。**  
   位置：[clicker-apoc-ui.js:105](/D:/claude研究/clawd-pet-v3/src/clicker-apoc-ui.js:105)、[clicker-apoc-ui.js:156](/D:/claude研究/clawd-pet-v3/src/clicker-apoc-ui.js:156)、[gacha-fx.js:18](/D:/claude研究/clawd-pet-v3/src/gacha-fx.js:18)。  
   重現：點怪後趁碎片尚未消失立即招募；`GachaFx.init()` 切畫布卻保留粒子。記憶體測試確認原舞台粒子在招募 context 執行 `fillRect`，舊畫布也沒被清除。此外，招募期間放置擊倒怪物，會再把畫布切回舞台。  
   建議：切層前停止並清除末世粒子；招募期間不要播放舞台擊倒特效。若兩層需同時播放，讓 scope 綁定自己的畫布。

2. **商店每秒重建按鈕，鍵盤焦點會丟失。**  
   位置：[clicker-apoc-ui.js:347](/D:/claude研究/clawd-pet-v3/src/clicker-apoc-ui.js:347)、[clicker-apoc-ui.js:352](/D:/claude研究/clawd-pet-v3/src/clicker-apoc-ui.js:352)。  
   重現：末世隊伍有放置收益時開商店，Tab 到換券或外觀按鈕，等待金幣增加。`Math.floor(a.coins)` 改變使快取失效，`replaceChildren()` 刪掉正在聚焦的按鈕。  
   建議：保留按鈕節點，只更新金額、文案及 disabled；不要把每秒增加的餘額當成整個面板的重建條件。

3. **日期往返可反覆重置換券加價。**  
   位置：[clicker-apoc-economy.js:205](/D:/claude研究/clawd-pet-v3/src/clicker-apoc-economy.js:205)。  
   重現：同一天換兩張→系統日期前進一天換一張→日期調回原日再換。實測價格依序是基價的 `1、1.25、1、1` 倍。仍會扣金幣，但可規避每日累進價格。  
   建議：日期回退時沿用最後有效日及次數，只有日期往前才重置。這能擋往返洗價；任意持續快轉時間則需要可信時間來源才能完整防堵。

**不用修（說明為什麼）**

1. **舊券、付費進度與 pending 收下流程目前正確。**  
   位置：[clicker-apoc-economy.js:88](/D:/claude研究/clawd-pet-v3/src/clicker-apoc-economy.js:88)、[clicker-apoc-economy.js:287](/D:/claude研究/clawd-pet-v3/src/clicker-apoc-economy.js:287)。  
   驗證：以 `ticketsBought=42、tickets=3` 加合法 pending 正規化並收下；結果保留 `paidDraws=42、tickets=3`，再次收下回傳 `accepted=false`。  
   原因／建議：付款早已完成，收下只加卡正確；維持現行流程，不要補扣券。

2. **換券提交具有兩邊一起成功或失敗的結構。**  
   位置：[clicker-apoc-ui.js:324](/D:/claude研究/clawd-pet-v3/src/clicker-apoc-ui.js:324)、[clicker-save.js:307](/D:/claude研究/clawd-pet-v3/src/clicker-save.js:307)。  
   驗證步驟：讓測試 storage 的 `setItem` 拋錯，再提交換券候選狀態，檢查原金幣與券數。程式先複製、驗證及寫入，成功後才替換工作狀態；失敗路徑不替換。  
   原因／建議：沒有先扣一邊再寫另一邊的問題，維持單次提交。

3. **貼紙資料與收藏卡「每秒重載 iframe」目前無須修。**  
   位置：[sticker.js:2](/D:/claude研究/clawd-pet-v3/src/apoc/sticker.js:2)、[build_sticker.py:44](/D:/claude研究/clawd-pet-v3/tools/apoc/build_sticker.py:44)、[clicker-album.js:240](/D:/claude研究/clawd-pet-v3/src/clicker-album.js:240)、[clicker-album.js:616](/D:/claude研究/clawd-pet-v3/src/clicker-album.js:616)。  
   驗證：產生器僅在記憶體計算，輸出與現有 71 筆資料完全一致，素材皆存在。收藏卡開啟後，若只增加放置金幣、推進戰鬥，末世卡冊的快取鍵不變，refresh 直接返回。  
   原因／建議：目前沒有每秒因收益變化重建 iframe 的路徑；維持現行快取，勿加入金幣或戰鬥時間欄位。
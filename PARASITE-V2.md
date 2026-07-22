# 寄生 v2：篡奪頭臉（覆蓋式）

## 需求（使用者參考圖已確認）
珍母寄生不再「站在宿主頭頂上」，改成**圓頂直接罩住宿主的頭和臉**：
珍母整隻疊在宿主同一位置，白圓頂＝取代宿主的頭，宿主身體從圓頂下露出，觸手垂在宿主身上。

## 幾何依據（不要重新發明）
- 所有角色頭頂等高線＝CSS y=93；珍母圓頂頂端＝CSS y≈91（height 163，top=254-163）。
- 因此黏附位置改成**兩視窗完全對齊**：`x = host.x`、`y = host.y`（原本的 `-161×scale` 偏移刪除）。
  圓頂（CSS 91~200）自然罩住任何宿主的頭臉區，觸手（200~254）垂在身體上，腳底同貼地。

## 實作項目（src-tauri/src/main.rs）
1. `parasite_start` 黏附迴圈：offset 改 0（x、y 都直接跟宿主），註解說明上述幾何依據。
2. **入場動畫**：開始寄生時不要瞬移——從當前位置到宿主位置做 300ms 的 ease-out 平滑移動
   （比照 walk 的插值寫法，33ms step），到位後才進入 50ms 跟隨迴圈。
3. z 順序維持：黏附開始時 `set_always_on_top(true)` 重新確認（已有，保留）。
4. 結束落地：既有小拋物線落地保留；因為現在跟宿主同位置（已貼地），落地改成
   「往旁邊小跳開一步」：vx = ±rng(150..250)×scale、vy = -rng(200..300)×scale（跳離宿主）。
5. **測試端點**：`spawn_claude_listener` 加 `/pet/parasite`——找目前存在的 zhenmu 寵物視窗
   （main 或 pet_zhenmu），對它觸發與 `parasite_start` 相同的流程（繞過機率與 20s 計時，
   但冷卻與「找不到宿主」的檢查照舊）。比照 `/pet/multi` 的寫法。實作方式建議：把
   parasite_start 的本體抽成 `fn try_parasite(app, zhenmu_label) -> bool`，command 與 HTTP 都呼叫它。

## JS（src/pet.js）
- 台詞微調：珍母 `parasite:1` 改說「這個頭我收下了～」；宿主 `parasited:1` 改說「我的臉！？」。
- 其他行為不變。

## 驗證
- `cargo check`、`cargo test`（cargo 在 %USERPROFILE%\.cargo\bin\cargo.exe，於 src-tauri 執行）
- `node --check src/pet.js`
- 版本號三處（tauri.conf.json / package.json / Cargo.toml）升 0.4.1。
- 不要 git commit。

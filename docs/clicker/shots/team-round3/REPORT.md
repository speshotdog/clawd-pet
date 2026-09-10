# 編隊第三輪實測報告

驗收：**1104 PASS／0 FAIL／2 待實機／1 基準值**；整體 **NEEDS_DEVICE**。未 commit、未 push。

[390×844 原尺寸](team-390x844-original.png) · [1440×900 原尺寸](team-1440x900-original.png) · [完整圖集](index.html) · [驗收 JSON](acceptance.json) · [黑角 JSON](corners.json) · [執行紀錄](run.log)

手機固定三欄、卡寬 112px，其餘列在卡區垂直捲動。兩頁合計 20 張卡；逐張捲入視窗後量裁切。桌面排版、卡面 shadow root、承載與地圖保留。

| 尺寸 | 欄數 | 卡寬 px | 可見卡面積 % viewport | 非卡片 UI % | 相鄰卡重疊 px² |
|---|---:|---:|---:|---:|---:|
| 1440x900 | 5.000～5.000 | 180.000～180.000 | 46.062～46.062 | 28.492～28.492 | 0.000～0.000 |
| 1024x768 | 5.000～5.000 | 143.000～143.000 | 45.060～45.060 | 29.818～29.818 | 0.000～0.000 |
| 390x844 | 3.000～3.000 | 112.000～112.000 | 46.241～46.241 | 29.883～29.883 | 0.000～0.000 |

手機 20 張卡的視窗裁切：0.000～0.000%。面積分母仍為完整 viewport，只計可見卡矩形聯集並依捲動祖先裁切。45～70% 門檻保持原值；若未通過即保留 FAIL，不以畫面外卡片補足。

| 尺寸 | 承載接縫差異 % | 詳情差異 % | 增亮 /255 | 卡內核心差異 % |
|---|---:|---:|---:|---:|
| 1440x900 | 32.369～33.413 | 12.605～12.964 | 11.000～16.000 | 0.000～0.000 |
| 1024x768 | 32.379～32.469 | 13.060～13.644 | 11.000～16.000 | 0.000～0.000 |
| 390x844 | 33.424～33.513 | 12.351～12.925 | 11.000～16.000 | 0.000～0.000 |

黑角使用既有 check_card_corners.py 的共用取樣函式；本輪依 BRIEF 採暗像素占比 ≥5% 且最暗 ≤6，暗像素定義為 ≤max(4, 在地中位×0.35)。取樣固定 WAAPI currentTime=0 並等雙重 rAF。負控制樣式直接注入 shadow root，先驗證 ::after content。

- team current：**PASS**，黑角 0／44。
- team negative_control：**FAIL**，黑角 12／44。
- map：SKIP，沒有掛載卡面。

負控制 FAIL 是預期結果，驗收要求其至少檢出一角；不可把負控制沒有生效當作通過。

正式退役三尺寸 team-* 的 new_language_area、texture_area、texture_blank_delta：編隊已採卡牌語言，工作盤刮痕／導軌比例不再適用。共有 9 個指標實例，包含前輪 8 FAIL 與 1 PASS（手機 texture_area）；為一致性，整組退役。移除清單：

- `team-1440x900.new_language_area`（前輪 FAIL）
- `team-1440x900.texture_area`（前輪 FAIL）
- `team-1440x900.texture_blank_delta`（前輪 FAIL）
- `team-1024x768.new_language_area`（前輪 FAIL）
- `team-1024x768.texture_area`（前輪 FAIL）
- `team-1024x768.texture_blank_delta`（前輪 FAIL）
- `team-390x844.new_language_area`（前輪 FAIL）
- `team-390x844.texture_area`（前輪 PASS）
- `team-390x844.texture_blank_delta`（前輪 FAIL）

地圖歷史 248 項已執行 248 項：{'PASS': 245, 'FAIL': 0, 'NEEDS_DEVICE': 2, 'BASELINE': 1}。地圖同名指標繼續執行。真實 hidden 分頁兩項仍待實機，未冒充通過。

受保護檔案變更：0.000～0.000 個；SHA-256 使用前輪原始基線。卡內幾何、Z、字級改動 0 項。地圖像素比對見 [JSON](map-pixel-regression.json)：{'1440x900-on.png': {'changed_pixels': 0, 'total_pixels': 1296000}, '1024x768-on.png': {'changed_pixels': 0, 'total_pixels': 786432}, '390x844-on.png': {'changed_pixels': 0, 'total_pixels': 329160}}。

未通過項目（上下限未更動）：

無 FAIL。驗收程序退出碼為 1，原因是兩項 NEEDS_DEVICE；未將待實機項目算作通過。

人工辨識與美感、真實 hidden 分頁仍須人工／實機判定。完整量測證據、混合隊伍與技能殼回歸保留在 acceptance.json。

重現：`python _art/holo-test/build_map20.py`、`python _art/holo-test/check_team20.py`、`python _art/holo-test/report_team20.py`。

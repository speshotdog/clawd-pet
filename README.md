# 熱狗小夥伴 HotDog Pet 🌭🐶

<p align="center"><img src="app-icon.png" width="180" alt="穿熱狗裝的狗狗" /></p>

一隻住在 Windows 桌面上的「穿熱狗裝的狗狗」。Tauri 2 + WebView2 打造，閒置 CPU 趨近於零，
角色本體是原創插畫，眼睛與四肢是可動圖層。

## 功能

- **活著的感覺**：呼吸、隨機眨眼、視線跟著游標、打字時蹦蹦跳
- **互動**：點一下打招呼（+心情）、雙擊轉圈、拖曳時瞪大眼掙扎、放下 Q 彈落地
- **心情 / 飽食度**：隨時間衰減、互動回升，關掉重開會記得；餓了會垂眼討食
- **餵食**：右鍵選單餵熱狗，🌭 從天而降
- **巡邏模式**：貼著工作列沿螢幕底邊來回走，會左右轉身
- **Claude Code 連動**：你送出訊息它進入工作模式，Claude 完成回合它轉圈慶祝
- **睡覺**：閒置 90 秒打瞌睡冒 Zzz
- **逐像素點擊穿透**：只有角色本體攔截滑鼠，透明處完全不干擾
- 位置記憶、開機自啟開關、系統匣與右鍵選單、多螢幕支援

## 技術重點

- **不用全域滑鼠/鍵盤鉤子**（避免拖累遊戲輸入延遲）——Rust 原生輪詢 `GetCursorPos` / `GetAsyncKeyState`
- **常駐動畫用 30fps JS 迴圈**而非 CSS 無限動畫（透明視窗會被逼著以螢幕更新率合成）
- `--disable-features=CalculateNativeWinOcclusion` 防止全螢幕遊戲時被判定遮擋而凍結
- 四肢拆件：切割線貼齊輪廓帶、存根逐欄貼合腿形，旋轉不露接縫
- Claude Code 連動：內建 `127.0.0.1:17872` HTTP 監聽，hooks 用 `curl` 敲

## 建置

需求：Rust (stable-msvc)、Node.js、VS Build Tools (C++)

```bash
npm install
npm run dev      # 開發模式
npm run build    # 打包（NSIS 安裝檔）
# 或直接
cd src-tauri && cargo build --release
```

## Claude Code hooks 設定

`~/.claude/settings.json`：

```json
{
  "hooks": {
    "UserPromptSubmit": [{ "hooks": [{ "type": "command", "command": "curl.exe -s -m 1 http://127.0.0.1:17872/claude/start >/dev/null 2>&1 || true", "async": true, "timeout": 3 }] }],
    "Stop": [{ "hooks": [{ "type": "command", "command": "curl.exe -s -m 1 http://127.0.0.1:17872/claude/stop >/dev/null 2>&1 || true", "async": true, "timeout": 3 }] }]
  }
}
```

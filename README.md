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
- **Claude Code 連動**：你送出訊息它進入工作模式，頭上出現熱狗醬進度條
  （偽進度＋斜紋流動，完成時補滿變綠）；Claude 完成回合它轉圈慶祝；
  停在權限確認等你按時，它會舉手提醒你；連續工作 30 秒以上會冒汗 💦
- **多工感知**：多個 Claude Code session 同時跑時，進度條旁出現 ×N 徽章，
  每完成一件報數，全部完成才收條慶祝
- **雙角色**：熱狗狗狗／女僕狐狐，都是原插畫直接拆件（去背後切出可動部件，
  切割縫藏在輪廓帶或暗色交界裡，詳見[角色製作工法](角色製作工法.md)）。
  狐狐可動件：雙腳、持刀手臂（舉刀提醒）、大尾巴（開心猛搖）。
  右鍵選單切換，重啟後記得選擇
- **多人模式**：右鍵「多人模式（找夥伴來）」，另一位角色開第二個視窗一起住在
  桌面上——各自散步巡邏、位置分開記憶，打字/Claude 事件兩隻一起反應，
  心情飽食度共用（餵哪隻都算）。夥伴右鍵可餵食或收回
- **睡覺**：閒置 90 秒打瞌睡冒 Zzz
- **逐像素點擊穿透**：只有角色本體攔截滑鼠，透明處完全不干擾
- 位置記憶、開機自啟開關、系統匣與右鍵選單、多螢幕支援

## 技術重點

- **不用全域滑鼠/鍵盤鉤子**（避免拖累遊戲輸入延遲）——Rust 原生輪詢 `GetCursorPos` / `GetAsyncKeyState`
- **常駐動畫用 30fps JS 迴圈**而非 CSS 無限動畫（透明視窗會被逼著以螢幕更新率合成）
- `--disable-features=CalculateNativeWinOcclusion` 防止全螢幕遊戲時被判定遮擋而凍結
- **DPI 縮放修正**：無邊框＋不可縮放的視窗在 >100% 顯示縮放下，建立時會拿到未縮放的
  實體尺寸（角色被腰斬）。而且 WebView2 的 devicePixelRatio 是「顯示縮放 × 文字大小」
  的疊乘（例 150%×125% = 1.875），Win32 `GetDpiForWindow` 量不到後者——所以由前端
  載入後回報真實 dpr（`fit_window` 指令），後端把實體視窗撐到 `200×dpr`，dpr 變化
  （跨螢幕、改系統設定）會自動重新適配。`resizable:false` 會鎖死尺寸，改尺寸前需
  暫時解鎖；記住的位置也會夾回可見工作區
- 四肢拆件：切割線貼齊輪廓帶、存根逐欄貼合腿形，旋轉不露接縫
- **膝蓋毛刺修正**：存根頂部是平切直邊，旋轉時直角會掃出輪廓外（尖刺感）。
  對策：`clipPath` 圓角裁切（rx=14，跟著腿旋轉，超界只露圓肩）＋走路擺幅
  17°→13°（直角掃出量壓進 10px 輪廓線厚度內）
- Claude Code 連動：內建 `127.0.0.1:17872` HTTP 監聽，hooks 用 `curl` 敲

## 建置

### 第一次：一鍵補齊環境

clone 下來後執行（雙擊 `setup.bat` 也可以）：

```powershell
npm run setup
```

腳本會逐項偵測並只補缺的：Node.js、Rust (stable-msvc)、VS C++ Build Tools、
WebView2 Runtime，最後跑 `npm install`。已經有的直接跳過。

> 如果它裝了新東西，請開一個**新的**終端機視窗再繼續，否則 PATH 吃不到。

### 之後

```bash
npm run dev      # 開發模式
npm run build    # 打包（NSIS 安裝檔）
# 或直接
cd src-tauri && cargo build --release
```

### 給終端使用者

打包出來的 NSIS 安裝檔已設定 `webviewInstallMode: downloadBootstrapper`，
對方電腦若缺 WebView2 Runtime 會在安裝時自動靜默下載補上，不需要 Rust 或 Node.js。

## Claude Code hooks 設定

`~/.claude/settings.json`：

```json
{
  "hooks": {
    "UserPromptSubmit": [{ "hooks": [{ "type": "command", "command": "curl.exe -s -m 1 http://127.0.0.1:17872/claude/start >/dev/null 2>&1 || true", "async": true, "timeout": 3 }] }],
    "Stop": [{ "hooks": [{ "type": "command", "command": "curl.exe -s -m 1 http://127.0.0.1:17872/claude/stop >/dev/null 2>&1 || true", "async": true, "timeout": 3 }] }],
    "Notification": [{ "hooks": [{ "type": "command", "command": "curl.exe -s -m 1 http://127.0.0.1:17872/claude/wait >/dev/null 2>&1 || true", "async": true, "timeout": 3 }] }]
  }
}
```

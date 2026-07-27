// Clawd — 桌面小夥伴 後端
// 原則：不用全域滑鼠/鍵盤鉤子（避免拖累遊戲輸入延遲），
// 一律用便宜的原生輪詢（GetCursorPos / GetAsyncKeyState），閒置 CPU 趨近於零。
#![windows_subsystem = "windows"] // debug 版也不開主控台視窗

use std::collections::HashMap;
use std::sync::atomic::Ordering;   // 墓碑事件／殺戮模式／操作模式的 AtomicBool 開關
use std::sync::{LazyLock, Mutex};
use std::time::{Duration, Instant};
use tauri::{
    menu::{CheckMenuItemBuilder, ContextMenu, MenuBuilder, MenuItemBuilder},
    tray::TrayIconBuilder,
    AppHandle, Emitter, Manager, PhysicalPosition, WebviewUrl, WebviewWindow, WebviewWindowBuilder,
};

#[repr(C)]
struct Point {
    x: i32,
    y: i32,
}
#[repr(C)]
#[derive(Clone, Copy, PartialEq, Eq)]
struct Rect {
    left: i32,
    top: i32,
    right: i32,
    bottom: i32,
}

#[repr(C)]
struct MonitorInfo {
    cb_size: u32,
    rc_monitor: Rect,
    rc_work: Rect,
    dw_flags: u32,
}

#[link(name = "user32")]
extern "system" {
    fn GetCursorPos(p: *mut Point) -> i32;
    fn GetAsyncKeyState(v_key: i32) -> i16;
    fn SystemParametersInfoW(action: u32, param: u32, pv: *mut Rect, ini: u32) -> i32;
    fn MonitorFromWindow(hwnd: isize, flags: u32) -> isize;
    fn GetMonitorInfoW(hmon: isize, info: *mut MonitorInfo) -> i32;
    fn GetDpiForWindow(hwnd: isize) -> u32;
}

const SPI_GETWORKAREA: u32 = 0x0030;
const MONITOR_DEFAULTTONEAREST: u32 = 2;

// 除錯日誌（主控台已隱藏，寫到 %TEMP%\clawd-debug.log）
fn dlog(msg: &str) {
    use std::io::Write;
    let p = std::env::temp_dir().join("clawd-debug.log");
    if let Ok(mut f) = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(p)
    {
        let _ = writeln!(f, "{msg}");
    }
}

fn cursor_pos() -> (i32, i32) {
    let mut p = Point { x: 0, y: 0 };
    unsafe { GetCursorPos(&mut p) };
    (p.x, p.y)
}

fn work_area() -> Rect {
    let mut r = Rect {
        left: 0,
        top: 0,
        right: 1920,
        bottom: 1040,
    };
    unsafe { SystemParametersInfoW(SPI_GETWORKAREA, 0, &mut r, 0) };
    r
}

// 視窗目前所在螢幕的工作區（支援多螢幕；失敗時退回主螢幕）
fn work_area_of(window: &WebviewWindow) -> Rect {
    if let Ok(hwnd) = window.hwnd() {
        let hmon = unsafe { MonitorFromWindow(hwnd.0 as isize, MONITOR_DEFAULTTONEAREST) };
        if hmon != 0 {
            let mut mi = MonitorInfo {
                cb_size: std::mem::size_of::<MonitorInfo>() as u32,
                rc_monitor: Rect {
                    left: 0,
                    top: 0,
                    right: 0,
                    bottom: 0,
                },
                rc_work: Rect {
                    left: 0,
                    top: 0,
                    right: 0,
                    bottom: 0,
                },
                dw_flags: 0,
            };
            if unsafe { GetMonitorInfoW(hmon, &mut mi) } != 0 {
                return mi.rc_work;
            }
        }
    }
    work_area()
}

// 每個視窗各自的「走路/拖曳中」旗標（多人模式下互不干擾）
static BUSY_WINDOWS: Mutex<Vec<String>> = Mutex::new(Vec::new());

// 前端回報的睡眠狀態。踢人評估在後端集中跑，才不會因為多人視窗各自計時而重複觸發。
static SLEEP_STATE: LazyLock<Mutex<HashMap<String, bool>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));
// 被踢與寄生的冷卻各自記錄；Instant 不落盤，重開程式自然重新開始計時。
static KICK_COOLDOWN: LazyLock<Mutex<HashMap<String, Instant>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));
static PARASITE_STATE: LazyLock<Mutex<HashMap<String, String>>> =
    LazyLock::new(|| Mutex::new(HashMap::new())); // 珍母 label -> 宿主 label
static PARASITE_COOLDOWN: LazyLock<Mutex<HashMap<String, Instant>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));
// 各視窗上次存位置的時間（Moved 事件節流用）
static MOVE_SAVED_AT: LazyLock<Mutex<HashMap<String, Instant>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));
// The floating menu asks for this state during its first page load, then receives
// subsequent openings through the `menu-state` event.
static MENU_STATE: LazyLock<Mutex<serde_json::Value>> =
    LazyLock::new(|| Mutex::new(serde_json::json!({})));

fn busy_start(label: &str) -> bool {
    let mut v = BUSY_WINDOWS.lock().unwrap();
    if v.iter().any(|x| x == label) {
        false
    } else {
        v.push(label.to_string());
        true
    }
}

fn busy_end(label: &str) {
    BUSY_WINDOWS.lock().unwrap().retain(|x| x != label);
}

fn is_busy(label: &str) -> bool {
    BUSY_WINDOWS.lock().unwrap().iter().any(|x| x == label)
}

fn is_sleeping(label: &str) -> bool {
    SLEEP_STATE
        .lock()
        .unwrap()
        .get(label)
        .copied()
        .unwrap_or(false)
}

// 視窗邏輯尺寸（CSS px），需與 tauri.conf.json 及前端 #stage 一致
const WIN_W: f64 = 240.0;
const WIN_H: f64 = 256.0;
const MENU_W: f64 = 300.0;
// 主視窗選單：手風琴一次只展開一組，最高的一組（角色清單）剛好塞得下。
// 超出時 .menu-groups 會出現捲軸，所以估不準也只是多一條捲軸，不會裁掉按鈕。
// v0.5 快速鍵多了三顆（墓碑／殺戮／操作）、角色從六隻變九隻，548 會把設定區壓到
// 只剩 ~130px，展開任一組就爆掉。加到 680。
// ⚠ 實體高度是 MENU_H × dpr，小螢幕/高 dpr 可能塞不下 → show_menu_window 會夾回工作區。
const MENU_H: f64 = 680.0;
// 夥伴選單只有「狀態＋餵食＋收回夥伴」，用同樣的高度會留一大片空面板
const MENU_H_COMPANION: f64 = 200.0;
// 選單視窗現在有兩種高度，resize_physical / fit_window 都得看同一份
static MENU_HEIGHT: Mutex<f64> = Mutex::new(MENU_H);
// 玩具視窗邏輯尺寸（CSS px），需與 toy.html 的 #stage 一致
const TOY_W: f64 = 150.0;
const TOY_H: f64 = 120.0;

// 依 label 查邏輯尺寸：寵物視窗（main / pet_*）= 240x256，玩具（toy_*）= 150x120
fn logical_size(label: &str) -> (f64, f64) {
    if label == "petmenu" {
        (MENU_W, *MENU_HEIGHT.lock().unwrap())
    } else if label.starts_with("toy_") {
        (TOY_W, TOY_H)
    } else {
        (WIN_W, WIN_H)
    }
}

// 縮放檔位表（顯示名, 倍率）。選單「大小：」單選區從這張表迴圈產生；
// 前端存 localStorage petscale（浮點字串），預設 1.0（標準）。
const SCALES: &[(&str, f64)] = &[
    ("迷你", 0.7),
    ("小", 0.85),
    ("標準", 1.0),
    ("大", 1.15),
    ("特大", 1.3),
];

// 角色資料表（id, 顯示名, 是否為隱藏角色）。加新角色只動這一行；選單「角色：」單選區、
// 「夥伴：」多選區與「隱藏角色：」區都從這張表迴圈產生。需與 menu.js 的 CHARACTERS 一致。
// hidden=true 的角色平常不列進角色/夥伴清單，要先在「隱藏角色：」區打勾解鎖。
const CHARS: &[(&str, &str, bool)] = &[
    ("dog", "熱狗狗狗", false),
    ("fox", "女僕狐狐", false),
    ("jiaobu2", "膠布", false),
    ("jiaobu", "膠布（原版）", true),
    ("yueyue2", "玥玥", false),
    ("yueyue", "玥玥（原版）", true),
    ("zhenzhen2", "珍珍", false),
    ("zhenzhen", "珍珍（原版）", true),
    ("zhenmu", "珍母", false),
    ("caihua", "采華", false),
    ("lk", "ㄌㄎ", false),
    ("yang", "羊咩", false),
];

// hidden=true 的角色由 menu.js 依 state.revealed 過濾（真值存在前端 localStorage
// 的 petrevealed，經 show_menu_window 帶進選單狀態）。原生選單已移除，後端不需要鏡像。

// 所有寵物視窗（主視窗 + 任意多個以 "pet_" 開頭的夥伴視窗）
fn pet_windows(app: &AppHandle) -> Vec<WebviewWindow> {
    app.webview_windows()
        .into_iter()
        .filter(|(label, _)| label == "main" || label.starts_with("pet_"))
        .map(|(_, w)| w)
        .collect()
}

// 把視窗實體尺寸撐到「CSS 尺寸 × 縮放比」。
// resizable:false 會把 min/max 鎖死在建立時的尺寸，set_size 會被夾回去；
// 暫時解鎖 → 改尺寸 → 鎖回（鎖回時 min/max 會重設為新尺寸）。
fn resize_physical(win: &WebviewWindow, scale: f64) {
    let (w, h) = logical_size(win.label());
    let _ = win.set_resizable(true);
    let _ = win.set_size(tauri::PhysicalSize::new(
        (w * scale).round() as u32,
        (h * scale).round() as u32,
    ));
    let _ = win.set_resizable(false);
}

// 啟動時的第一步近似：用 Win32 DPI 撐一次（此時 Tauri 的 scale_factor 可能
// 還是 1.0 不可信）。注意這只涵蓋「顯示縮放」；Windows 的「文字大小」輔助
// 設定會再疊乘（例：150% 顯示 × 125% 文字 = dpr 1.875），GetDpiForWindow
// 量不到，所以最終權威是前端回報的 devicePixelRatio（fit_window 指令）。
fn fix_dpi_size(win: &WebviewWindow) {
    let scale = win
        .hwnd()
        .map(|h| unsafe { GetDpiForWindow(h.0 as isize) } as f64 / 96.0)
        .unwrap_or(1.0);
    resize_physical(win, scale);
}

// 指令：前端載入後回報真實 devicePixelRatio，把視窗撐到剛好裝下 240x256 CSS
#[tauri::command]
fn fit_window(window: WebviewWindow, dpr: f64) {
    if (0.5..=4.0).contains(&dpr) {
        resize_physical(&window, dpr);
        // 玩具視窗：把真實 dpr 存進物理狀態（重力/衝量要乘 scale）
        if window.label().starts_with("toy_") {
            if let Some(s) = TOY_STATE.lock().unwrap().get_mut(window.label()) {
                s.scale = dpr;
            }
        }
    }
}

// ------------------------------------------------------------
// 開機自動啟動（HKCU Run 登錄機碼）
// ------------------------------------------------------------
const RUN_KEY: &str = r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run";

fn reg_cmd(args: &[&str]) -> bool {
    use std::os::windows::process::CommandExt;
    std::process::Command::new("reg")
        .args(args)
        .creation_flags(0x0800_0000) // CREATE_NO_WINDOW
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

fn is_autostart() -> bool {
    reg_cmd(&["query", RUN_KEY, "/v", "ClawdPet"])
}

fn set_autostart(on: bool) {
    if on {
        if let Ok(exe) = std::env::current_exe() {
            let d = format!("\"{}\"", exe.display());
            reg_cmd(&[
                "add", RUN_KEY, "/v", "ClawdPet", "/t", "REG_SZ", "/d", &d, "/f",
            ]);
        }
    } else {
        reg_cmd(&["delete", RUN_KEY, "/v", "ClawdPet", "/f"]);
    }
}

// ------------------------------------------------------------
// 視窗位置記憶
// ------------------------------------------------------------
fn config_dir() -> std::path::PathBuf {
    let base = std::env::var("LOCALAPPDATA").unwrap_or_else(|_| ".".into());
    std::path::Path::new(&base).join("com.clawd.pet")
}

fn pos_file(label: &str) -> std::path::PathBuf {
    let name = if label == "main" {
        "pos.json".into()
    } else {
        format!("pos-{label}.json")
    };
    config_dir().join(name)
}

fn save_pos(win: &WebviewWindow) {
    if let Ok(p) = win.outer_position() {
        let f = pos_file(win.label());
        if let Some(dir) = f.parent() {
            let _ = std::fs::create_dir_all(dir);
        }
        let _ = std::fs::write(f, format!("{{\"x\":{},\"y\":{}}}", p.x, p.y));
    }
}

fn load_pos(label: &str) -> Option<(i32, i32)> {
    let s = std::fs::read_to_string(pos_file(label)).ok()?;
    let v: serde_json::Value = serde_json::from_str(&s).ok()?;
    Some((v["x"].as_i64()? as i32, v["y"].as_i64()? as i32))
}

// 所有寵物視窗共用的初始化：DPI 修正、位置還原（夾回可見範圍）、穿透、游標執行緒
fn setup_pet_window(win: &WebviewWindow) {
    fix_dpi_size(win);
    if let Some((x, y)) = load_pos(win.label()) {
        let _ = win.set_position(PhysicalPosition::new(x, y));
        let wa = work_area_of(win);
        if let Ok(size) = win.outer_size() {
            let cx = x.clamp(wa.left, (wa.right - size.width as i32).max(wa.left));
            let cy = y.clamp(wa.top, (wa.bottom - size.height as i32).max(wa.top));
            if (cx, cy) != (x, y) {
                let _ = win.set_position(PhysicalPosition::new(cx, cy));
            }
        }
    } else {
        let wa = work_area();
        if let Ok(size) = win.outer_size() {
            // 夥伴視窗預設放主寵物左邊一點；多個夥伴依 label 錯開避免完全重疊
            let off = if win.label() == "main" {
                32
            } else {
                260 + (win.label().bytes().map(|b| b as i32).sum::<i32>() % 6) * 70
            };
            let _ = win.set_position(PhysicalPosition::new(
                wa.right - size.width as i32 - off,
                wa.bottom - size.height as i32 - 8,
            ));
        }
    }
    let _ = win.set_ignore_cursor_events(true);
}

// ------------------------------------------------------------
// 多人模式：任意多個夥伴視窗，label=pet_<character>，角色由 URL query 指定
// ------------------------------------------------------------
#[tauri::command]
fn set_companion(app: AppHandle, on: bool, character: String) {
    dlog(&format!("set_companion on={on} char={character}"));
    let label = format!("pet_{character}");
    // 視窗建立必須在「非主執行緒」做：build() 會同步等 WebView2 初始化，
    // 而初始化需要主執行緒泵訊息——在主執行緒（或主執行緒閉包）裡呼叫會自我死鎖。
    std::thread::spawn(move || {
        dlog("companion worker enter");
        // 先銷毀同 label 的舊視窗（重複呼叫安全）
        if let Some(w) = app.get_webview_window(&label) {
            save_pos(&w);
            let _ = w.destroy();
            dlog(&format!("{label} destroyed"));
        }
        if !on {
            return;
        }
        // destroy() 只排程 WebView 關閉；還沒從 registry 移除時就用同 label 建新窗，
        // 會被 Tauri 拒絕。換角 reload 會立刻重建夥伴，因此必須先等到舊 label 消失。
        if !wait_for_window_gone(&app, &label) {
            dlog(&format!("{label} destroy timeout before recreate"));
            return;
        }
        let url = format!("index.html?char={character}");
        let build = || {
            WebviewWindowBuilder::new(&app, &label, WebviewUrl::App(url.clone().into()))
                .title("HotDogPal")
                .inner_size(240.0, 256.0)
                .transparent(true)
                .decorations(false)
                .always_on_top(true)
                .skip_taskbar(true)
                .resizable(false)
                .maximizable(false)
                .minimizable(false)
                .shadow(false)
                .build()
        };
        let r = match build() {
            Ok(w) => Ok(w),
            Err(e) => {
                dlog(&format!("{label} create FAILED, retrying: {e:?}"));
                std::thread::sleep(Duration::from_millis(500));
                build()
            }
        };
        match r {
            Ok(w) => {
                setup_pet_window(&w);
                dlog(&format!("{label} created"));
            }
            Err(e) => dlog(&format!("{label} create FAILED: {e:?}")),
        }
    });
}

// WebView 的 destroy 完成時間不固定；用短輪詢避免同 label 重建競態。
fn wait_for_window_gone(app: &AppHandle, label: &str) -> bool {
    for _ in 0..60 {
        // 60 * 50ms = 3 秒上限
        if app.get_webview_window(label).is_none() {
            return true;
        }
        std::thread::sleep(Duration::from_millis(50));
    }
    false
}

// 指令：讓視窗間互傳 pet-cmd（例：主視窗把 Claude 工作分派數同步給夥伴）。
// 指定 target label 用 emit_to 送，不再廣播給全部視窗讓前端自己過濾。
#[tauri::command]
fn relay(app: AppHandle, target: String, payload: serde_json::Value) {
    let _ = app.emit_to(&target, "pet-cmd", payload);
}

// ============================================================
// 玩具系統：玩具像足球被寵物踢來踢去
// 玩具視窗 label = toy_<id>，物理在獨立執行緒跑（僅玩具視窗存在時），
// 收玩具（視窗銷毀）下個 tick 執行緒自動收工，無殭屍。
// ============================================================

// 玩具資料表（id, 顯示名）。加新玩具只動這一行；選單「玩具：」區從這迴圈產生。
const TOYS: &[(&str, &str)] = &[
    ("dino", "小恐龍"),
    ("ballyellow", "黃色球"),
    ("beachball", "皮球"),
];

// 物理常數（基準值以 CSS px 計，乘 dpr(scale) 得實體 px）。數值抓「可愛的感覺」：
// 彈跳不狂、滾動 ~2 秒內停（離線模擬：初速 800,-700 → 落地 0.63s、靜止 1.83s、2 次彈跳）。
const TOY_DT: f64 = 1.0 / 30.0; // 物理步長（秒），對應 ~33ms tick
const TOY_GRAVITY: f64 = 2800.0; // 重力 px/s²
const TOY_WALL_REST: f64 = 0.8; // 撞牆反彈保留係數
const TOY_FLOOR_REST: f64 = 0.45; // 落地彈跳保留係數
const TOY_FRICTION: f64 = 0.90; // 地面滾動每 tick 摩擦
const TOY_STOP_V: f64 = 20.0; // 滾動速度低於此即歸零（CSS px/s）
const TOY_BOUNCE_MIN: f64 = 60.0; // 彈跳量低於此閾值即落地靜止（CSS px/s）

// 玩具物理狀態（實體像素座標；x,y = 視窗左上角）
#[derive(Clone, Copy)]
struct Phys {
    x: f64,
    y: f64,
    vx: f64,
    vy: f64,
    grounded: bool,
    grabbed: bool,
    scale: f64,
}

impl Phys {
    // 推進一個 tick。left/right = 視窗左上角 x 的可行範圍，ground_y = 落地時的 y。
    fn step(&mut self, left: f64, right: f64, ground_y: f64) {
        if self.grounded {
            // 地面滾動：摩擦減速、撞牆反彈、貼齊地面線
            self.x += self.vx * TOY_DT;
            self.vx *= TOY_FRICTION;
            if self.vx.abs() < TOY_STOP_V * self.scale {
                self.vx = 0.0;
            }
            if self.x < left {
                self.x = left;
                self.vx = -self.vx * TOY_WALL_REST;
            } else if self.x > right {
                self.x = right;
                self.vx = -self.vx * TOY_WALL_REST;
            }
            self.y = ground_y;
        } else {
            // 空中：重力、撞左右緣反彈、落地彈跳
            self.vy += TOY_GRAVITY * self.scale * TOY_DT;
            self.x += self.vx * TOY_DT;
            self.y += self.vy * TOY_DT;
            if self.x < left {
                self.x = left;
                self.vx = -self.vx * TOY_WALL_REST;
            } else if self.x > right {
                self.x = right;
                self.vx = -self.vx * TOY_WALL_REST;
            }
            if self.y >= ground_y {
                self.y = ground_y;
                let bounce_v = self.vy * TOY_FLOOR_REST;
                if bounce_v >= TOY_BOUNCE_MIN * self.scale {
                    self.vy = -bounce_v; // 再彈一次
                } else {
                    self.vy = 0.0;
                    self.grounded = true; // 彈跳量太小 → 落地
                }
            }
        }
    }
    fn moving(&self) -> bool {
        !self.grounded || self.vx != 0.0
    }
}

// 每個玩具視窗的物理狀態，label -> Phys
static TOY_STATE: LazyLock<Mutex<HashMap<String, Phys>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

// 輕量 PRNG（避免引外部 crate）：xorshift64
struct Rng(u64);
impl Rng {
    fn new() -> Self {
        let seed = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_nanos() as u64)
            .unwrap_or(0x9E37_79B9)
            | 1;
        Rng(seed)
    }
    fn next_u64(&mut self) -> u64 {
        let mut x = self.0;
        x ^= x << 13;
        x ^= x >> 7;
        x ^= x << 17;
        self.0 = x;
        x
    }
    fn range(&mut self, lo: f64, hi: f64) -> f64 {
        lo + (self.next_u64() as f64 / u64::MAX as f64) * (hi - lo)
    }
}

// 寵物視窗的實體寬高已包含「角色縮放 × dpr」，反推後可和玩具物理共用同一組 CSS 常數。
fn window_scale(win: &WebviewWindow) -> f64 {
    win.outer_size()
        .map(|s| (s.height as f64 / WIN_H).max(0.01))
        .unwrap_or(1.0)
}

// 寵物被踢或珍母掉落時共用的拋物線。工作區在開始時鎖定，避免飛越多螢幕接縫時牆壁搬家。
// 呼叫端必須先 busy_start；落地靜止或視窗消失時才在這裡解除 busy。
fn spawn_pet_physics(app: AppHandle, label: String, mut ph: Phys, locked_wa: Rect) {
    std::thread::spawn(move || loop {
        std::thread::sleep(Duration::from_millis(33));
        let Some(win) = app.get_webview_window(&label) else {
            busy_end(&label);
            return;
        };
        let Ok(size) = win.outer_size() else { continue };
        let left = locked_wa.left as f64;
        let right = (locked_wa.right as f64 - size.width as f64).max(left);
        let ground_y = locked_wa.bottom as f64 - size.height as f64;
        ph.step(left, right, ground_y);
        let _ = win.set_position(PhysicalPosition::new(
            ph.x.round() as i32,
            ph.y.round() as i32,
        ));
        if ph.grounded && ph.vx == 0.0 {
            busy_end(&label);
            return;
        }
    });
}

// 睡著的角色被踢飛：先取得位置和目前 dpr，再把運動交給共用 Phys。
fn kick_sleeping_pet(app: &AppHandle, label: &str, dir: f64, rng: &mut Rng) -> bool {
    if !busy_start(label) {
        return false;
    }
    let Some(win) = app.get_webview_window(label) else {
        busy_end(label);
        return false;
    };
    let (Ok(pos), Ok(_size)) = (win.outer_position(), win.outer_size()) else {
        busy_end(label);
        return false;
    };
    let scale = window_scale(&win);
    let ph = Phys {
        x: pos.x as f64,
        y: pos.y as f64,
        vx: dir * rng.range(500.0, 900.0) * scale,
        vy: -rng.range(400.0, 800.0) * scale,
        grounded: false,
        grabbed: false,
        scale,
    };
    spawn_pet_physics(app.clone(), label.to_string(), ph, work_area_of(&win));
    true
}

// 全域睡眠評估：所有睡著的角色每十秒最多被檢查一次，附近清醒夥伴才有 8% 機率踢它。
fn spawn_sleep_kick_evaluator(app: AppHandle) {
    std::thread::spawn(move || {
        let mut rng = Rng::new();
        loop {
            std::thread::sleep(Duration::from_secs(10));
            let sleepers: Vec<String> = {
                let mut state = SLEEP_STATE.lock().unwrap();
                state.retain(|label, _| app.get_webview_window(label).is_some());
                state
                    .iter()
                    .filter_map(|(label, on)| on.then(|| label.clone()))
                    .collect()
            };
            for sleeper in sleepers {
                if is_busy(&sleeper) || !is_sleeping(&sleeper) || is_dead(&sleeper) {
                    continue;
                }
                if KICK_COOLDOWN
                    .lock()
                    .unwrap()
                    .get(&sleeper)
                    .map(|at| at.elapsed() < Duration::from_secs(180))
                    .unwrap_or(false)
                {
                    continue;
                }
                let Some(sw) = app.get_webview_window(&sleeper) else {
                    continue;
                };
                let (Ok(sp), Ok(ss)) = (sw.outer_position(), sw.outer_size()) else {
                    continue;
                };
                let sleeper_cx = sp.x as f64 + ss.width as f64 / 2.0;
                let sleeper_wa = work_area_of(&sw);
                let max_dist = 250.0 * window_scale(&sw);
                let mut kicker: Option<(String, f64)> = None;
                for kw in pet_windows(&app) {
                    let klabel = kw.label().to_string();
                    if klabel == sleeper
                        || is_sleeping(&klabel)
                        || is_busy(&klabel)
                        || is_dead(&klabel)
                        || work_area_of(&kw) != sleeper_wa
                    {
                        continue;
                    }
                    let (Ok(kp), Ok(ks)) = (kw.outer_position(), kw.outer_size()) else {
                        continue;
                    };
                    let kicker_cx = kp.x as f64 + ks.width as f64 / 2.0;
                    let dist = (kicker_cx - sleeper_cx).abs();
                    if dist < max_dist && kicker.as_ref().map(|v| dist < v.1).unwrap_or(true) {
                        kicker = Some((klabel, dist));
                    }
                }
                let Some((kicker, _)) = kicker else { continue };
                if rng.range(0.0, 1.0) >= 0.08 {
                    continue;
                }
                let Some(kw) = app.get_webview_window(&kicker) else {
                    continue;
                };
                let Ok(kp) = kw.outer_position() else {
                    continue;
                };
                let kicker_cx = kp.x as f64 + window_scale(&kw) * WIN_W / 2.0;
                let dir = if sleeper_cx >= kicker_cx { 1.0 } else { -1.0 };
                if kick_sleeping_pet(&app, &sleeper, dir, &mut rng) {
                    KICK_COOLDOWN
                        .lock()
                        .unwrap()
                        .insert(sleeper.clone(), Instant::now());
                    let _ = app.emit_to(
                        &kicker,
                        "pet-cmd",
                        serde_json::json!({ "cmd": "kick", "dir": dir as i32 }),
                    );
                    let _ = app.emit_to(&sleeper, "pet-cmd", serde_json::json!({ "cmd": "kicked" }));
                }
            }
        }
    });
}

// 睡眠狀態由前端唯一回報；重新載入或視窗關閉後，全域評估會在下一輪清掉不存在的 label。
#[tauri::command]
fn set_sleeping(window: WebviewWindow, on: bool) {
    SLEEP_STATE
        .lock()
        .unwrap()
        .insert(window.label().to_string(), on);
}

// ============================================================
// 墓碑死亡系統
// 有刀的角色在巡邏時經過別人，低機率把對方變成墓碑（楓之谷式：墓碑從天上砸下來）。
// 兩隻都有刀＝對撞擲骰，誰運氣差誰死。殺戮模式把機率拉到 100%。
// 位置判定放在 Rust：只有這裡看得到所有寵物視窗的座標（前端各自沙箱）。
// ============================================================

// 拿刀的角色（拆件時有「持刀手臂」的那幾隻）
const KNIFE_CHARS: &[&str] = &["fox", "jiaobu"];
const MURDER_TICK_SECS: u64 = 3;
const MURDER_RANGE: f64 = 130.0; // CSS px（再乘視窗 scale）＝「擦身而過」的距離
const MURDER_CHANCE: f64 = 0.06; // 每次相遇的擊殺機率；殺戮模式為 1.0
const HUNT_RANGE: f64 = 900.0; // CSS px：殺戮模式下主動追殺的搜索半徑
const MURDER_PAIR_COOLDOWN_SECS: u64 = 45; // 同一對的相遇冷卻，避免並肩走時連環判定
const DEAD_MAX_SECS: u64 = 60; // 保險絲：前端沒回報復活就自動解除死亡狀態

// label -> (角色 id, 是否巡邏中)。前端載入與每次切巡邏時用 set_pet_info 同步。
static PET_INFO: LazyLock<Mutex<HashMap<String, (String, bool)>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));
static DEAD_STATE: LazyLock<Mutex<HashMap<String, Instant>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));
// key = 兩個 label 排序後接起來，值＝上次相遇時間
static MURDER_COOLDOWN: LazyLock<Mutex<HashMap<String, Instant>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));
static MURDER_ON: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);
static KILL_MODE: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);

fn has_knife(character: &str) -> bool {
    KNIFE_CHARS.contains(&character)
}

fn is_dead(label: &str) -> bool {
    DEAD_STATE.lock().unwrap().contains_key(label)
}

// 指令：前端同步自己的角色 id 與巡邏狀態（Rust 讀不到 localStorage）
#[tauri::command]
fn set_pet_info(window: WebviewWindow, character: String, patrol: bool) {
    PET_INFO
        .lock()
        .unwrap()
        .insert(window.label().to_string(), (character, patrol));
}

// 指令：墓碑事件總開關與殺戮模式（真值存在前端 localStorage，這裡是鏡像）
#[tauri::command]
fn set_murder(on: bool, killmode: bool) {
    MURDER_ON.store(on, Ordering::Relaxed);
    KILL_MODE.store(killmode, Ordering::Relaxed);
}

// 指令：復活（前端墓碑演完自己回報）
#[tauri::command]
fn revive(window: WebviewWindow) {
    DEAD_STATE.lock().unwrap().remove(window.label());
}

// ============================================================
// 操作模式：選單開啟後用 ←/→ 操作主視窗角色，空白鍵（或 ↑）跳躍。
// 沿用既有的 GetAsyncKeyState 輪詢，不裝全域鍵盤鉤子（README 的設計原則：
// 鉤子會拖累遊戲輸入延遲）。
// ⚠ 輪詢是全域的：開著這個模式時在別的視窗按方向鍵，角色一樣會跑。
//   所以預設關閉，由使用者自己在選單開。
// ============================================================
const VK_SPACE: i32 = 0x20;
const VK_LEFT: i32 = 0x25;
const VK_UP: i32 = 0x26;
const VK_RIGHT: i32 = 0x27;
const CTRL_TICK_MS: u64 = 33; // 30fps，與其他常駐迴圈一致
const CTRL_SPEED: f64 = 6.5; // 每 tick 移動的 CSS px（≈195 px/s）
const CTRL_JUMP_V: f64 = 1000.0; // 跳躍初速 CSS px/s
const CTRL_JUMP_VX: f64 = 170.0; // 跳躍時順著「當下按住的方向」帶一點水平位移

static CONTROL_MODE: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);

#[tauri::command]
fn set_control(on: bool) {
    CONTROL_MODE.store(on, Ordering::Relaxed);
}

fn key_down(vk: i32) -> bool {
    (unsafe { GetAsyncKeyState(vk) } as u16) & 0x8000 != 0
}

fn spawn_control_thread(app: AppHandle) {
    std::thread::spawn(move || {
        let mut last_dir: i32 = 0;
        let mut jump_was_down = false;
        loop {
            std::thread::sleep(Duration::from_millis(CTRL_TICK_MS));
            if !CONTROL_MODE.load(Ordering::Relaxed) {
                if last_dir != 0 {
                    let _ = app.emit_to(
                        "main",
                        "pet-cmd",
                        serde_json::json!({ "cmd": "ctrl", "dir": 0 }),
                    );
                    last_dir = 0;
                }
                continue;
            }
            let Some(win) = app.get_webview_window("main") else {
                continue;
            };
            if is_dead("main") {
                continue;
            }
            let jump = key_down(VK_SPACE) || key_down(VK_UP);
            let dir = key_down(VK_RIGHT) as i32 - key_down(VK_LEFT) as i32;

            // 跳躍：邊緣觸發，交給既有的拋物線物理（落地時它自己 busy_end）
            if jump && !jump_was_down && !is_busy("main") {
                jump_was_down = true;
                if busy_start("main") {
                    if let (Ok(pos), Ok(_)) = (win.outer_position(), win.outer_size()) {
                        let scale = window_scale(&win);
                        let ph = Phys {
                            x: pos.x as f64,
                            y: pos.y as f64,
                            // 有按方向就往那邊跳，沒按就原地垂直跳
                            vx: dir as f64 * CTRL_JUMP_VX * scale,
                            vy: -CTRL_JUMP_V * scale,
                            grounded: false,
                            grabbed: false,
                            scale,
                        };
                        spawn_pet_physics(app.clone(), "main".into(), ph, work_area_of(&win));
                    } else {
                        busy_end("main");
                    }
                }
                continue;
            }
            if !jump {
                jump_was_down = false;
            }
            // 被抓著/跳躍中/走路中就不接管位置，免得跟其他動作搶視窗座標
            if is_busy("main") {
                continue;
            }
            if dir != last_dir {
                let _ = app.emit_to(
                    "main",
                    "pet-cmd",
                    serde_json::json!({ "cmd": "ctrl", "dir": dir }),
                );
                last_dir = dir;
            }
            if dir != 0 {
                if let (Ok(pos), Ok(size)) = (win.outer_position(), win.outer_size()) {
                    let wa = work_area_of(&win);
                    let step = (CTRL_SPEED * window_scale(&win)).round() as i32;
                    let max_x = (wa.right - size.width as i32).max(wa.left);
                    let nx = (pos.x + dir * step).clamp(wa.left, max_x);
                    let _ = win.set_position(PhysicalPosition::new(nx, pos.y));
                }
            }
        }
    });
}

struct PetSnap {
    label: String,
    character: String,
    patrol: bool,
    cx: f64,
    wa: Rect,
    scale: f64,
}

fn spawn_murder_evaluator(app: AppHandle) {
    std::thread::spawn(move || {
        let mut rng = Rng::new();
        loop {
            std::thread::sleep(Duration::from_secs(MURDER_TICK_SECS));
            // 視窗關掉就清掉殘留狀態；死太久（前端沒回報復活）自動解除，避免卡死
            {
                let alive = |label: &String| app.get_webview_window(label).is_some();
                PET_INFO.lock().unwrap().retain(|l, _| alive(l));
                DEAD_STATE
                    .lock()
                    .unwrap()
                    .retain(|l, at| alive(l) && at.elapsed() < Duration::from_secs(DEAD_MAX_SECS));
                MURDER_COOLDOWN
                    .lock()
                    .unwrap()
                    .retain(|_, at| at.elapsed() < Duration::from_secs(MURDER_PAIR_COOLDOWN_SECS));
            }
            if !MURDER_ON.load(Ordering::Relaxed) {
                continue;
            }
            run_murder_pass(&app, &mut rng, false);
        }
    });
}

// 目前在場、活著、沒在忙的寵物視窗快照（位置判定只有後端看得到）
fn snapshot_pets(app: &AppHandle) -> Vec<PetSnap> {
    let mut pets: Vec<PetSnap> = Vec::new();
    for w in pet_windows(app) {
        let label = w.label().to_string();
        if is_dead(&label) || is_busy(&label) {
            continue;
        }
        let Some((character, patrol)) = PET_INFO.lock().unwrap().get(&label).cloned() else {
            continue;
        };
        let (Ok(pos), Ok(size)) = (w.outer_position(), w.outer_size()) else {
            continue;
        };
        pets.push(PetSnap {
            label,
            character,
            patrol,
            cx: pos.x as f64 + size.width as f64 / 2.0,
            wa: work_area_of(&w),
            scale: window_scale(&w),
        });
    }
    pets
}

// 殺戮模式的追殺導引：有刀的不再等「剛好擦身而過」，主動走向最近的活人。
// 只負責把距離拉近，真正的擊殺仍由 run_murder_pass 的配對迴圈判定。
// 回傳這一輪導引了幾隻。force=true 時略過巡邏條件（`/pet/murder?hunt=1`）。
fn run_hunt_pass(app: &AppHandle, pets: &[PetSnap], dead_now: &[String], force: bool) -> usize {
    let mut guided = 0usize;
    for (i, hunter) in pets.iter().enumerate() {
        if !has_knife(&hunter.character) || !(hunter.patrol || force) {
            continue;
        }
        if dead_now.contains(&hunter.label) {
            continue;
        }
        // 找同一螢幕、還活著、離得最近的一隻（另一個拿刀的也算——那就是對撞）
        let mut best: Option<(f64, f64)> = None; // (距離, 獵物中心 x)
        for (j, prey) in pets.iter().enumerate() {
            if j == i || prey.wa != hunter.wa || dead_now.contains(&prey.label) {
                continue;
            }
            let d = (prey.cx - hunter.cx).abs();
            if d < HUNT_RANGE * hunter.scale && best.map(|b| d < b.0).unwrap_or(true) {
                best = Some((d, prey.cx));
            }
        }
        let Some((dist, prey_cx)) = best else { continue };
        let reach = MURDER_RANGE * hunter.scale;
        if dist < reach {
            continue; // 已經在刀下，別再往前擠
        }
        // 目標＝獵物旁 reach 的一半，走完就落在相遇範圍內
        let side = if prey_cx >= hunter.cx { 1.0 } else { -1.0 };
        let dx = (prey_cx - side * reach * 0.5) - hunter.cx;
        let _ = app.emit_to(
            hunter.label.as_str(),
            "pet-cmd",
            serde_json::json!({ "cmd": "chase", "dx": dx.round() }),
        );
        guided += 1;
        dlog(&format!(
            "hunt: {} -> dist={dist:.0} dx={dx:.0}",
            hunter.label
        ));
    }
    guided
}

// 掃一輪所有寵物視窗配對，該死的就讓它死。回傳這一輪殺掉幾個。
// force=true（`/pet/murder` 測試鉤子）：略過巡邏條件、機率與相遇冷卻，只保留距離判定。
fn run_murder_pass(app: &AppHandle, rng: &mut Rng, force: bool) -> usize {
    let kill_mode = KILL_MODE.load(Ordering::Relaxed);
    let pets = snapshot_pets(app);

    let mut killed = 0usize;
    let mut dead_now: Vec<String> = Vec::new();
    for i in 0..pets.len() {
        for j in (i + 1)..pets.len() {
            let (a, b) = (&pets[i], &pets[j]);
            if a.wa != b.wa {
                continue; // 不同螢幕不算相遇
            }
            // 同一輪內已經倒下的不再參與（三隻擠在一起時不會連環暴斃）
            if dead_now.contains(&a.label) || dead_now.contains(&b.label) {
                continue;
            }
            // 動手的一方必須「有刀且正在巡邏」
            let a_can = has_knife(&a.character) && (a.patrol || force);
            let b_can = has_knife(&b.character) && (b.patrol || force);
            if !a_can && !b_can {
                continue;
            }
            let gap = (a.cx - b.cx).abs();
            let reach = MURDER_RANGE * a.scale.max(b.scale);
            if force {
                dlog(&format!(
                    "murder probe: {} ({}) vs {} ({}) gap={gap:.0} reach={reach:.0}",
                    a.label, a.character, b.label, b.character
                ));
            }
            if gap >= reach {
                continue;
            }
            // 這一對算「相遇過了」：不管有沒有得手都進冷卻，免得並肩散步時連環擲骰
            let key = if a.label < b.label {
                format!("{}|{}", a.label, b.label)
            } else {
                format!("{}|{}", b.label, a.label)
            };
            if !force {
                let mut cd = MURDER_COOLDOWN.lock().unwrap();
                if cd
                    .get(&key)
                    .map(|at| at.elapsed() < Duration::from_secs(MURDER_PAIR_COOLDOWN_SECS))
                    .unwrap_or(false)
                {
                    continue;
                }
                cd.insert(key, Instant::now());
            }
            if !force && !kill_mode && rng.range(0.0, 1.0) >= MURDER_CHANCE {
                continue;
            }
            // 兩邊都有刀＝對撞，擲骰決定誰運氣差；否則有刀的殺沒刀的
            let a_armed = has_knife(&a.character);
            let b_armed = has_knife(&b.character);
            let a_dies = if a_armed && b_armed {
                rng.range(0.0, 1.0) < 0.5
            } else {
                b_armed
            };
            let (victim, killer) = if a_dies { (a, b) } else { (b, a) };
            DEAD_STATE
                .lock()
                .unwrap()
                .insert(victim.label.clone(), Instant::now());
            dead_now.push(victim.label.clone());
            killed += 1;
            let duel = a_armed && b_armed;
            let _ = app.emit_to(
                victim.label.as_str(),
                "pet-cmd",
                serde_json::json!({ "cmd": "die", "duel": duel }),
            );
            let _ = app.emit_to(
                killer.label.as_str(),
                "pet-cmd",
                serde_json::json!({ "cmd": "kill" }),
            );
            dlog(&format!(
                "murder: {} killed {} (duel={duel}, kill_mode={kill_mode}, force={force})",
                killer.label, victim.label
            ));
        }
    }

    if kill_mode {
        run_hunt_pass(app, &pets, &dead_now, force);
    }
    killed
}

// 完成寄生後讓珍母從宿主身旁小跳開，並通知仍在場的雙方結束演出。
fn finish_parasite(app: AppHandle, zhenmu: String, host: String) {
    PARASITE_COOLDOWN
        .lock()
        .unwrap()
        .insert(zhenmu.clone(), Instant::now());
    if let Some(w) = app.get_webview_window(&zhenmu) {
        let _ = w.emit_to(
            &zhenmu,
            "pet-cmd",
            serde_json::json!({ "cmd": "parasite", "on": false }),
        );
        if let Ok(pos) = w.outer_position() {
            let scale = window_scale(&w);
            let mut rng = Rng::new();
            let dir = if rng.range(0.0, 1.0) < 0.5 { -1.0 } else { 1.0 };
            let ph = Phys {
                x: pos.x as f64,
                y: pos.y as f64,
                vx: dir * rng.range(150.0, 250.0) * scale,
                vy: -rng.range(200.0, 300.0) * scale,
                grounded: false,
                grabbed: false,
                scale,
            };
            spawn_pet_physics(app.clone(), zhenmu.clone(), ph, work_area_of(&w));
        } else {
            busy_end(&zhenmu);
        }
    } else {
        busy_end(&zhenmu);
    }
    if let Some(w) = app.get_webview_window(&host) {
        let _ = w.emit_to(
            &host,
            "pet-cmd",
            serde_json::json!({ "cmd": "parasited", "on": false }),
        );
    }
}

// 開始寄生的共用流程；前端 command 與本機測試端點都經過相同的冷卻和宿主檢查。
fn try_parasite(app: AppHandle, zhenmu_label: &str) -> bool {
    let zhenmu = zhenmu_label.to_string();
    let Some(window) = app.get_webview_window(&zhenmu) else {
        return false;
    };
    if is_busy(&zhenmu)
        || PARASITE_STATE.lock().unwrap().contains_key(&zhenmu)
        || PARASITE_COOLDOWN
            .lock()
            .unwrap()
            .get(&zhenmu)
            .map(|at| at.elapsed() < Duration::from_secs(300))
            .unwrap_or(false)
    {
        return false;
    }
    let (Ok(zp), Ok(zs)) = (window.outer_position(), window.outer_size()) else {
        return false;
    };
    let zhenmu_cx = zp.x as f64 + zs.width as f64 / 2.0;
    let zhenmu_wa = work_area_of(&window);
    let max_dist = 500.0 * window_scale(&window);
    let occupied_hosts: Vec<String> = PARASITE_STATE.lock().unwrap().values().cloned().collect();
    let mut host: Option<(String, f64)> = None;
    for candidate in pet_windows(&app) {
        let label = candidate.label().to_string();
        if label == zhenmu
            || is_busy(&label)
            || occupied_hosts.iter().any(|h| h == &label)
            || work_area_of(&candidate) != zhenmu_wa
        {
            continue;
        }
        let (Ok(pos), Ok(size)) = (candidate.outer_position(), candidate.outer_size()) else {
            continue;
        };
        let dist = (pos.x as f64 + size.width as f64 / 2.0 - zhenmu_cx).abs();
        if dist < max_dist && host.as_ref().map(|h| dist < h.1).unwrap_or(true) {
            host = Some((label, dist));
        }
    }
    let Some((host, _)) = host else { return false };
    if !busy_start(&zhenmu) {
        return false;
    }
    PARASITE_STATE
        .lock()
        .unwrap()
        .insert(zhenmu.clone(), host.clone());
    let _ = window.set_always_on_top(true); // 黏附後重新確認層級，確保珍母壓在宿主頭上。
    let _ = app.emit_to(
        &zhenmu,
        "pet-cmd",
        serde_json::json!({ "cmd": "parasite", "on": true }),
    );
    if let Some(w) = app.get_webview_window(&host) {
        let _ = w.emit_to(
            &host,
            "pet-cmd",
            serde_json::json!({ "cmd": "parasited", "on": true }),
        );
    }
    std::thread::spawn(move || {
        // 先用 300ms ease-out 入場；珍母與宿主的頭頂等高（約 CSS y=93），
        // 圓頂直接覆蓋頭臉，所以兩個視窗最終完全對齊，不再保留舊的 -161 偏移。
        let Some(hw) = app.get_webview_window(&host) else {
            let host = PARASITE_STATE.lock().unwrap().remove(&zhenmu);
            if let Some(host) = host {
                finish_parasite(app, zhenmu, host);
            }
            return;
        };
        let (Ok(start), Ok(target)) = (window.outer_position(), hw.outer_position()) else {
            let host = PARASITE_STATE.lock().unwrap().remove(&zhenmu);
            if let Some(host) = host {
                finish_parasite(app, zhenmu, host);
            }
            return;
        };
        let entry_start = Instant::now();
        loop {
            let active = PARASITE_STATE
                .lock()
                .unwrap()
                .get(&zhenmu)
                .map(|h| h == &host)
                .unwrap_or(false);
            if !active {
                return; // parasite_end 已接手結束流程
            }
            let t = (entry_start.elapsed().as_millis() as f64 / 300.0).min(1.0);
            // cubic ease-out：快起步、靠近宿主時自然收尾。
            let e = 1.0 - (1.0 - t).powi(3);
            let x = start.x as f64 + (target.x as f64 - start.x as f64) * e;
            let y = start.y as f64 + (target.y as f64 - start.y as f64) * e;
            let _ = window.set_position(PhysicalPosition::new(x.round() as i32, y.round() as i32));
            if t >= 1.0 {
                break;
            }
            std::thread::sleep(Duration::from_millis(33));
        }

        let mut rng = Rng::new();
        let until = Instant::now() + Duration::from_secs(rng.range(60.0, 180.0) as u64);
        loop {
            std::thread::sleep(Duration::from_millis(50));
            let active = PARASITE_STATE
                .lock()
                .unwrap()
                .get(&zhenmu)
                .map(|h| h == &host)
                .unwrap_or(false);
            if !active {
                return; // parasite_end 已接手結束流程
            }
            let (Some(zw), Some(hw)) = (
                app.get_webview_window(&zhenmu),
                app.get_webview_window(&host),
            ) else {
                break;
            };
            let Ok(hp) = hw.outer_position() else {
                continue;
            };
            // 頭頂同為 CSS y=93：x/y 完全對齊即可讓圓頂罩住頭臉、觸手垂在身上。
            let _ = zw.set_position(PhysicalPosition::new(hp.x, hp.y));
            if Instant::now() >= until {
                break;
            }
        }
        let host = PARASITE_STATE.lock().unwrap().remove(&zhenmu);
        if let Some(host) = host {
            finish_parasite(app, zhenmu, host);
        }
    });
    true
}

#[tauri::command]
fn parasite_start(window: WebviewWindow) -> bool {
    try_parasite(window.app_handle().clone(), window.label())
}

#[tauri::command]
fn parasite_end(window: WebviewWindow) -> bool {
    let zhenmu = window.label().to_string();
    let host = PARASITE_STATE.lock().unwrap().remove(&zhenmu);
    if let Some(host) = host {
        finish_parasite(window.app_handle().clone(), zhenmu, host);
        true
    } else {
        false
    }
}

// 指令：玩具被拖起(true)/放下(false)。抓取時暫停物理；放下從當前位置繼續（半空放開就落下）
#[tauri::command]
fn toy_grab(window: WebviewWindow, grabbed: bool) {
    let mut map = TOY_STATE.lock().unwrap();
    if let Some(s) = map.get_mut(window.label()) {
        s.grabbed = grabbed;
        if !grabbed {
            if let Ok(p) = window.outer_position() {
                s.x = p.x as f64;
                s.y = p.y as f64;
            }
            s.vx = 0.0;
            s.vy = 0.0;
            s.grounded = false; // 交給物理決定：貼地下 tick 立即靜止，半空則落下
        }
    }
}

// 指令：玩具右鍵選單（只有「收起玩具」）
#[tauri::command]
fn toy_menu(window: WebviewWindow, x: f64, y: f64) {
    let win = window.clone();
    let pos = tauri::Position::Physical(tauri::PhysicalPosition::new(x as i32, y as i32));
    let _ = window.run_on_main_thread(move || {
        let app = win.app_handle();
        let label = win.label().to_string();
        if let Ok(off) =
            MenuItemBuilder::with_id(format!("q_toyoff@{label}"), "收起玩具").build(app)
        {
            if let Ok(menu) = MenuBuilder::new(app).items(&[&off]).build() {
                let _ = menu.popup_at(win.as_ref().window(), pos);
            }
        }
    });
}

// 指令：建立/銷毀玩具視窗（寫法比照 set_companion）
#[tauri::command]
fn set_toy(app: AppHandle, on: bool, toy: String) {
    dlog(&format!("set_toy on={on} toy={toy}"));
    let label = format!("toy_{toy}");
    std::thread::spawn(move || {
        // 先銷毀同 label 的舊視窗（物理執行緒下個 tick 見視窗消失即收工）
        if let Some(w) = app.get_webview_window(&label) {
            save_pos(&w);
            let _ = w.destroy();
        }
        TOY_STATE.lock().unwrap().remove(&label);
        if !on {
            return;
        }
        if !wait_for_window_gone(&app, &label) {
            dlog(&format!("{label} destroy timeout before recreate"));
            return;
        }
        let url = format!("toy.html?toy={toy}");
        let build = || {
            WebviewWindowBuilder::new(&app, &label, WebviewUrl::App(url.clone().into()))
                .title("ClawdToy")
                .inner_size(TOY_W, TOY_H)
                .transparent(true)
                .decorations(false)
                .always_on_top(true)
                .skip_taskbar(true)
                .resizable(false)
                .maximizable(false)
                .minimizable(false)
                .shadow(false)
                .build()
        };
        let r = match build() {
            Ok(w) => Ok(w),
            Err(e) => {
                dlog(&format!("{label} create FAILED, retrying: {e:?}"));
                std::thread::sleep(Duration::from_millis(500));
                build()
            }
        };
        match r {
            Ok(w) => {
                setup_toy_window(&w);
                dlog(&format!("{label} created"));
            }
            Err(e) => dlog(&format!("{label} create FAILED: {e:?}")),
        }
    });
}

// 玩具視窗初始化：DPI 修正、位置還原/預設（貼地）、穿透、游標執行緒、物理執行緒
fn setup_toy_window(win: &WebviewWindow) {
    fix_dpi_size(win); // logical_size 對 toy_* 回 150x120
    let wa = work_area_of(win);
    if let (Ok(size), pos) = (win.outer_size(), load_pos(win.label())) {
        let (x, y) = if let Some((lx, ly)) = pos {
            (
                lx.clamp(wa.left, (wa.right - size.width as i32).max(wa.left)),
                ly.clamp(wa.top, (wa.bottom - size.height as i32).max(wa.top)),
            )
        } else {
            // 預設放主寵物左邊一段的地面上
            (
                wa.right - size.width as i32 - 360,
                wa.bottom - size.height as i32,
            )
        };
        let _ = win.set_position(PhysicalPosition::new(x, y));
    }
    let _ = win.set_ignore_cursor_events(true);
    spawn_toy_physics(win.clone());
}

// 玩具物理執行緒：~33ms tick。玩具視窗存在時才跑，銷毀即收工。
fn spawn_toy_physics(win: WebviewWindow) {
    let label = win.label().to_string();
    let app = win.app_handle().clone();
    // 初始化狀態：目前視窗位置、貼地靜止
    {
        let (x, y) = win
            .outer_position()
            .map(|p| (p.x as f64, p.y as f64))
            .unwrap_or((0.0, 0.0));
        TOY_STATE.lock().unwrap().insert(
            label.clone(),
            Phys {
                x,
                y,
                vx: 0.0,
                vy: 0.0,
                grounded: true,
                grabbed: false,
                scale: 1.0,
            },
        );
    }
    std::thread::spawn(move || {
        let mut rng = Rng::new();
        let mut eval_acc = 0.0f64; // 追逐/踢評估累加器（每 ~1s）
        let mut kick_cd = 0.0f64; // 踢後冷卻（秒）
        let mut was_moving = true;
        // 起跳時把工作區鎖住，跨螢幕縫時牆壁才不會跟著換到另一張螢幕。
        let mut locked_wa = work_area_of(&win);
        let mut was_grabbed = false;
        loop {
            std::thread::sleep(Duration::from_millis(33));
            // 視窗沒了（收玩具）→ 清狀態並收工
            let Some(w) = app.get_webview_window(&label) else {
                TOY_STATE.lock().unwrap().remove(&label);
                return;
            };
            let (w_w, w_h) = match w.outer_size() {
                Ok(s) => (s.width as f64, s.height as f64),
                Err(_) => continue,
            };
            // 取狀態副本
            let mut ph = match TOY_STATE.lock().unwrap().get(&label).copied() {
                Some(p) => p,
                None => return,
            };

            if ph.grabbed {
                // 使用者拖曳中：同步實際視窗位置、暫停物理
                if let Ok(p) = w.outer_position() {
                    ph.x = p.x as f64;
                    ph.y = p.y as f64;
                }
                ph.vx = 0.0;
                ph.vy = 0.0;
                if let Some(s) = TOY_STATE.lock().unwrap().get_mut(&label) {
                    s.x = ph.x;
                    s.y = ph.y;
                    s.vx = 0.0;
                    s.vy = 0.0;
                }
                if was_moving {
                    let _ = w.emit_to(
                        label.as_str(),
                        "toy-state",
                        serde_json::json!({ "airborne": false, "vx": 0.0, "vy": 0.0 }),
                    );
                    was_moving = false;
                }
                was_grabbed = true;
                continue;
            }

            // 只有靜止落地時可跟著玩具更新螢幕；拖到另一螢幕後放開則立刻重鎖。
            if was_grabbed || (ph.grounded && ph.vx == 0.0) {
                locked_wa = work_area_of(&w);
            }
            was_grabbed = false;
            let left = locked_wa.left as f64;
            let right = (locked_wa.right as f64 - w_w).max(left);
            let ground_y = locked_wa.bottom as f64 - w_h;

            // 推進物理並寫回
            ph.step(left, right, ground_y);
            if let Some(s) = TOY_STATE.lock().unwrap().get_mut(&label) {
                s.x = ph.x;
                s.y = ph.y;
                s.vx = ph.vx;
                s.vy = ph.vy;
                s.grounded = ph.grounded;
            }

            // 移動玩具視窗
            let _ = w.set_position(PhysicalPosition::new(
                ph.x.round() as i32,
                ph.y.round() as i32,
            ));

            // 事件：移動中才發（靜止落地時停止寫 DOM）
            let moving = ph.moving();
            if moving || was_moving {
                let _ = w.emit_to(
                    label.as_str(),
                    "toy-state",
                    serde_json::json!({ "airborne": !ph.grounded, "vx": ph.vx, "vy": ph.vy }),
                );
            }
            was_moving = moving;

            // ---- 追逐/踢評估（每 ~1s，條件：落地、非拖曳、冷卻結束）----
            kick_cd = (kick_cd - TOY_DT).max(0.0);
            eval_acc += TOY_DT;
            if eval_acc >= 1.0 {
                eval_acc = 0.0;
                if ph.grounded && !ph.grabbed && kick_cd <= 0.0 {
                    let toy_cx = ph.x + w_w / 2.0;
                    // 找水平距離 < 600*scale 內最近的寵物
                    let mut best: Option<(String, f64, f64)> = None; // (label, pet_cx, dist)
                    for pw in pet_windows(&app) {
                        let (Ok(pp), Ok(ps)) = (pw.outer_position(), pw.outer_size()) else {
                            continue;
                        };
                        let pet_cx = pp.x as f64 + ps.width as f64 / 2.0;
                        let dist = (pet_cx - toy_cx).abs();
                        if dist < 600.0 * ph.scale
                            && best.as_ref().map(|b| dist < b.2).unwrap_or(true)
                        {
                            best = Some((pw.label().to_string(), pet_cx, dist));
                        }
                    }
                    if let Some((plabel, pet_cx, dist)) = best {
                        let kick_dist = 130.0 * ph.scale;
                        // side = 玩具相對寵物的方向（+1 玩具在右）
                        let side = if toy_cx >= pet_cx { 1.0 } else { -1.0 };
                        if dist > kick_dist {
                            // 走過去踢：目標點 = 玩具旁 80px（別走進玩具裡）
                            let target_cx = toy_cx - side * 80.0 * ph.scale;
                            let dx = target_cx - pet_cx; // walk 吃實體 px
                            let _ = w.emit_to(
                                plabel.as_str(),
                                "pet-cmd",
                                serde_json::json!({ "cmd": "chase", "dx": dx.round() }),
                            );
                        } else {
                            // 踢！給玩具衝量往 side 方向飛
                            let dir = side;
                            let vx = dir * rng.range(600.0, 1100.0) * ph.scale;
                            let vy = -rng.range(500.0, 900.0) * ph.scale;
                            if let Some(s) = TOY_STATE.lock().unwrap().get_mut(&label) {
                                s.vx = vx;
                                s.vy = vy;
                                s.grounded = false;
                            }
                            let _ = w.emit_to(
                                plabel.as_str(),
                                "pet-cmd",
                                serde_json::json!({ "cmd": "kick", "dir": dir as i32 }),
                            );
                            kick_cd = 1.5;
                        }
                    }
                }
            }
        }
    });
}

// 統一的退出流程：存位置 → 先銷毀夥伴視窗 → app.exit；
// 事件迴圈若退不出來（pet2 曾卡死過 app.exit），1.5 秒後硬退保底
fn quit_app(app: &AppHandle) {
    dlog("quit_app");
    // 存所有寵物視窗位置，再銷毀夥伴＋玩具視窗
    for w in pet_windows(app) {
        save_pos(&w);
    }
    for (label, w) in app.webview_windows() {
        if label.starts_with("pet_") || label.starts_with("toy_") {
            if label.starts_with("toy_") {
                save_pos(&w);
            }
            let _ = w.destroy();
            SLEEP_STATE.lock().unwrap().remove(&label);
        }
    }
    let app2 = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_millis(300));
        app2.exit(0);
        std::thread::sleep(Duration::from_millis(1500));
        dlog("hard exit fallback");
        std::process::exit(0);
    });
}

// ------------------------------------------------------------
// 指令：前端逐像素判定後切換點擊穿透
// ------------------------------------------------------------
#[tauri::command]
fn set_click_through(window: WebviewWindow, ignore: bool) {
    let _ = window.set_ignore_cursor_events(ignore);
}

// 前端 JS 的日誌通道（除錯用）。原本走本機 HTTP 的 /pet/log/<msg>，
// 但那條路徑既要 URL 編碼又得對外開一個免驗證端點——IPC 直接送就好。
#[tauri::command]
fn js_log(window: WebviewWindow, msg: String) {
    dlog(&format!("js[{}]: {msg}", window.label()));
}

// ------------------------------------------------------------
// 指令：散步。主執行緒外平滑移動視窗，回傳動畫時長（ms）
// ------------------------------------------------------------
#[tauri::command]
fn walk(window: WebviewWindow, dx: f64) -> u64 {
    let label = window.label().to_string();
    if !busy_start(&label) {
        return 0; // 已在走或被抓著
    }
    let Ok(pos) = window.outer_position() else {
        busy_end(&label);
        return 0;
    };
    let Ok(size) = window.outer_size() else {
        busy_end(&label);
        return 0;
    };
    let wa = work_area_of(&window);
    let target = (pos.x as f64 + dx).clamp(wa.left as f64, (wa.right - size.width as i32) as f64);
    let dist = (target - pos.x as f64).abs();
    if dist < 10.0 {
        busy_end(&label);
        return 0;
    }
    let duration_ms = ((dist / 90.0) * 1000.0).max(800.0) as u64; // 90 px/s
    let start_x = pos.x as f64;
    let y = pos.y;
    std::thread::spawn(move || {
        let start = Instant::now();
        let step = Duration::from_millis(33); // 30fps 足夠，降低 DWM 負擔
        loop {
            let t = start.elapsed().as_millis() as f64 / duration_ms as f64;
            if t >= 1.0 {
                let _ = window.set_position(PhysicalPosition::new(target as i32, y));
                break;
            }
            // ease-in-out
            let e = if t < 0.5 {
                2.0 * t * t
            } else {
                1.0 - (-2.0 * t + 2.0).powi(2) / 2.0
            };
            let x = start_x + (target - start_x) * e;
            let _ = window.set_position(PhysicalPosition::new(x as i32, y));
            std::thread::sleep(step);
        }
        busy_end(&label);
    });
    duration_ms
}

// ------------------------------------------------------------
// 指令：貼齊目前螢幕的工作區底邊（巡邏模式用）
// ------------------------------------------------------------
#[tauri::command]
fn snap_bottom(window: WebviewWindow) {
    let wa = work_area_of(&window);
    if let (Ok(pos), Ok(size)) = (window.outer_position(), window.outer_size()) {
        let _ = window.set_position(PhysicalPosition::new(
            pos.x,
            wa.bottom - size.height as i32 + 2,
        ));
    }
}

// ------------------------------------------------------------
// 指令：右鍵選單（每次依當前狀態重建，事件由 app.on_menu_event 處理）
// ------------------------------------------------------------
#[tauri::command]
fn get_menu_state() -> serde_json::Value {
    MENU_STATE.lock().unwrap().clone()
}

#[tauri::command]
fn get_autostart() -> bool {
    is_autostart()
}

#[tauri::command]
fn close_menu_window(app: AppHandle) {
    if let Some(menu) = app.get_webview_window("petmenu") {
        let _ = menu.hide();
    }
}

// 選單尺寸必須用「算出來的實體尺寸」而不是 menu.outer_size()：
// 第一次開啟時 fit_window 還沒跑，outer_size 是缺了文字大小疊乘的偏小值，
// 用它 clamp 會讓選單底部多出一截沉進工作列。
fn menu_position(
    source: &WebviewWindow,
    menu_w: i32,
    menu_h: i32,
    x: f64,
    y: f64,
) -> PhysicalPosition<i32> {
    let source_pos = source
        .outer_position()
        .unwrap_or(PhysicalPosition::new(0, 0));
    let source_h = source.outer_size().map(|s| s.height as i32).unwrap_or(0);
    let wa = work_area_of(source);
    // 底線對齊角色腳底（＝寵物視窗底邊）：選單最低只到腳，不會沉進工作列
    let bottom_limit = (source_pos.y + source_h).min(wa.bottom);
    let left = (source_pos.x + x.round() as i32).clamp(wa.left, (wa.right - menu_w).max(wa.left));
    let top = (source_pos.y + y.round() as i32)
        .min(bottom_limit - menu_h)
        .max(wa.top);
    PhysicalPosition::new(left, top)
}

// 主視窗與夥伴視窗共用同一個選單視窗；source 決定餵食要餵誰、以及要不要
// 顯示只有主視窗管得動的區塊（角色/夥伴/玩具/大小/躲起來/回到右下角）。
#[tauri::command]
fn show_menu_window(
    window: WebviewWindow,
    mood: i32,
    fullness: i32,
    patrol: bool,
    character: String,
    companions: Vec<String>,
    revealed: Vec<String>,
    toys: Vec<String>,
    murder: bool,
    kill_mode: bool,
    control: bool,
    scale: f64,
    x: f64,
    y: f64,
) {
    let label = window.label().to_string();
    let companion = label != "main";
    // ⚠ MENU_H 是 CSS px，實體高度是它 × dpr。使用者的 dpr 是 1.875（150% 顯示 ×
    // 125% 文字），620 CSS 就是 1162 實體 px——比工作區還高，選單會被擠爆／頂部被切掉。
    // 所以一律夾回「工作區高度換算成 CSS px」再留 16px 餘裕；塞不下的部分交給
    // .menu-groups 的捲軸（手風琴一次只開一組，實務上很少真的需要捲）。
    let dpr = (window_scale(&window) / scale.max(0.1)).clamp(0.5, 4.0);
    let wa = work_area_of(&window);
    let max_css_h = ((wa.bottom - wa.top) as f64 / dpr - 16.0).max(240.0);
    let menu_h = if companion { MENU_H_COMPANION } else { MENU_H }.min(max_css_h);
    *MENU_HEIGHT.lock().unwrap() = menu_h;
    let state = serde_json::json!({
        "source": label,
        "companion": companion,
        "mood": mood.clamp(0, 100),
        "fullness": fullness.clamp(0, 100),
        "patrol": patrol,
        "murder": murder,
        "killMode": kill_mode,
        "control": control,
        "character": character,
        "companions": companions,
        "revealed": revealed,
        "toys": toys,
        "scale": scale,
        "autostart": is_autostart(),
    });
    *MENU_STATE.lock().unwrap() = state.clone();

    let source = window.clone();
    let app = window.app_handle().clone();
    // 視窗建立必須在「非主執行緒」做（同 set_companion）：build() 會同步等 WebView2
    // 初始化，而初始化需要主執行緒泵訊息——在主執行緒（含 run_on_main_thread 閉包）
    // 呼叫會自我死鎖：選單開不出來、整個主執行緒卡死、拖曳全失效。
    std::thread::spawn(move || {
        let menu = if let Some(existing) = app.get_webview_window("petmenu") {
            existing
        } else {
            match WebviewWindowBuilder::new(&app, "petmenu", WebviewUrl::App("menu.html".into()))
                .title("ClawdPet Menu")
                .inner_size(MENU_W, menu_h)
                .transparent(true)
                .decorations(false)
                .always_on_top(true)
                .skip_taskbar(true)
                .resizable(false)
                .maximizable(false)
                .minimizable(false)
                .shadow(false)
                .visible(false)
                .build()
            {
                Ok(created) => created,
                Err(err) => {
                    dlog(&format!("petmenu create FAILED: {err:?}"));
                    return;
                }
            }
        };
        // 寵物視窗實體高 = 256 × dpr × 角色縮放，反除角色縮放得真實 dpr
        // （含文字大小疊乘），開啟當下就把選單撐到正確實體尺寸，
        // 不等 menu.js 的 fit_window（那是 dpr 事後變化的保險）。
        let dpr = (window_scale(&source) / scale.max(0.1)).clamp(0.5, 4.0);
        resize_physical(&menu, dpr);
        let menu_w_px = (MENU_W * dpr).round() as i32;
        let menu_h_px = (menu_h * dpr).round() as i32;
        let _ = menu.set_position(menu_position(&source, menu_w_px, menu_h_px, x, y));
        let _ = app.emit_to("petmenu", "menu-state", state);
        let _ = menu.show();
        let _ = menu.set_focus();
    });
}

// 選單是常駐的（只有 ✕ / ESC 會關），所以數值必須持續同步——否則開著十分鐘，
// 顯示的還是十分鐘前的心情與飽食度。來源視窗每次寫入 stats 都會呼叫這裡，
// 選單沒開或不是自己開的就直接返回，成本近乎零。
#[tauri::command]
fn sync_menu_state(window: WebviewWindow, mood: i32, fullness: i32, patrol: bool) {
    let app = window.app_handle();
    let Some(menu) = app.get_webview_window("petmenu") else {
        return;
    };
    if !menu.is_visible().unwrap_or(false) {
        return;
    }
    let state = {
        let mut s = MENU_STATE.lock().unwrap();
        if s["source"].as_str() != Some(window.label()) {
            return;
        }
        s["mood"] = mood.clamp(0, 100).into();
        s["fullness"] = fullness.clamp(0, 100).into();
        s["patrol"] = patrol.into();
        s.clone()
    };
    let _ = app.emit_to("petmenu", "menu-state", state);
}

#[tauri::command]
fn menu_action(app: AppHandle, id: String) {
    // 選單一律不自動關閉（使用者要求：只有右上角 ✕ / ESC 會關），
    // 唯一例外是離開 app 前順手收掉。
    if id == "quit" {
        close_menu_window(app.clone());
    }
    let emit_main = |command: serde_json::Value| {
        if let Some(main) = app.get_webview_window("main") {
            let _ = main.emit_to("main", "pet-cmd", command);
        }
    };
    // 開啟這個選單的視窗（餵食要餵它、收回夥伴要收它）
    let source = MENU_STATE.lock().unwrap()["source"]
        .as_str()
        .unwrap_or("main")
        .to_string();
    let emit_source = |command: serde_json::Value| {
        if let Some(w) = app.get_webview_window(&source) {
            let _ = w.emit_to(source.as_str(), "pet-cmd", command);
        }
    };

    if let Some(character) = id.strip_prefix("char:") {
        if CHARS.iter().any(|(known, _, _)| known == &character) {
            emit_main(serde_json::json!({ "cmd": "char", "id": character }));
        }
        return;
    }
    if let Some(character) = id.strip_prefix("comp:") {
        if CHARS.iter().any(|(known, _, _)| known == &character) {
            emit_main(serde_json::json!({ "cmd": "comp", "id": character }));
        }
        return;
    }
    if let Some(character) = id.strip_prefix("reveal:") {
        if CHARS
            .iter()
            .any(|(known, _, hidden)| known == &character && *hidden)
        {
            emit_main(serde_json::json!({ "cmd": "reveal", "id": character }));
        }
        return;
    }
    if let Some(toy) = id.strip_prefix("toy:") {
        if TOYS.iter().any(|(known, _)| known == &toy) {
            emit_main(serde_json::json!({ "cmd": "toy", "id": toy }));
        }
        return;
    }
    if let Some(value) = id.strip_prefix("scale:") {
        if let Ok(scale) = value.parse::<f64>() {
            if SCALES
                .iter()
                .any(|(_, known)| (*known - scale).abs() < 0.001)
            {
                emit_main(serde_json::json!({ "cmd": "scale", "value": scale }));
            }
        }
        return;
    }

    match id.as_str() {
        "feed" => emit_source(serde_json::json!({ "cmd": "feed" })),
        "feedlove" => emit_source(serde_json::json!({ "cmd": "feedlove" })),
        // 夥伴選單的「收回夥伴」：label 去 pet_ 前綴取角色 id，交主視窗管清單
        "recall" => {
            if let Some(ch) = source.strip_prefix("pet_") {
                emit_main(serde_json::json!({ "cmd": "compoff", "id": ch }));
                close_menu_window(app.clone());
            }
        }
        "murder" => emit_main(serde_json::json!({ "cmd": "murder" })),
        "killmode" => emit_main(serde_json::json!({ "cmd": "killmode" })),
        "control" => emit_main(serde_json::json!({ "cmd": "control" })),
        "patrol" => {
            for pet in pet_windows(&app) {
                let label = pet.label().to_string();
                let _ = pet.emit_to(
                    label.as_str(),
                    "pet-cmd",
                    serde_json::json!({ "cmd": "patrol" }),
                );
            }
        }
        "hide" => {
            if let Some(main) = app.get_webview_window("main") {
                let _ = main.hide();
            }
        }
        "home" => {
            if let Some(main) = app.get_webview_window("main") {
                let wa = work_area_of(&main);
                if let Ok(size) = main.outer_size() {
                    let _ = main.set_position(PhysicalPosition::new(
                        wa.right - size.width as i32 - 32,
                        wa.bottom - size.height as i32 - 8,
                    ));
                    save_pos(&main);
                }
            }
        }
        "autostart" => set_autostart(!is_autostart()),
        "quit" => quit_app(&app),
        _ => {}
    }
}

// ------------------------------------------------------------
// 游標執行緒：單一執行緒 60ms 輪詢，把「相對視窗」座標丟給每個寵物/玩具視窗。
// 前端做逐像素命中 → 再回呼 set_click_through
// ------------------------------------------------------------
// 節流規則：游標在視窗附近時每 tick 都發（前端要即時更新視線與命中判定）；
// 一旦離開附近，只補發最後一筆讓前端釋放攔截，之後保持安靜。舊版的條件是
// 「不在附近『且』游標沒動才跳過」，等於滑鼠在桌面任何角落移動，每個視窗
// 都照樣吃 16fps 的 IPC＋hitTest——開六隻夥伴時約 110 events/s。
fn spawn_cursor_thread(app: AppHandle) {
    std::thread::spawn(move || {
        let mut near_windows: Vec<String> = Vec::new();
        loop {
            std::thread::sleep(Duration::from_millis(60));
            let (cx, cy) = cursor_pos();
            let mut still_near: Vec<String> = Vec::new();
            for (label, win) in app.webview_windows() {
                if label != "main" && !label.starts_with("pet_") && !label.starts_with("toy_") {
                    continue;
                }
                let (Ok(pos), Ok(size)) = (win.outer_position(), win.outer_size()) else {
                    continue;
                };
                let rx = cx - pos.x;
                let ry = cy - pos.y;
                let near = rx > -400
                    && ry > -400
                    && rx < size.width as i32 + 400
                    && ry < size.height as i32 + 400;
                if near {
                    still_near.push(label.clone());
                } else if !near_windows.iter().any(|l| l == &label) {
                    continue; // 早就離很遠，不用再吵前端
                }
                // emit_to 只會送到 label 相符的視窗範圍 listener（前端用
                // getCurrentWindow().listen 註冊），不會互吃對方座標。
                let _ = win.emit_to(
                    label.as_str(),
                    "cursor",
                    serde_json::json!({ "x": rx, "y": ry }),
                );
            }
            near_windows = still_near;
        }
    });
}

// ------------------------------------------------------------
// Claude Code 連動：本機 HTTP 監聽（hooks 用 curl 敲）
// GET /claude/start | /claude/stop | /claude/error | /claude/wait → 轉發給前端
// GET /pet/quit | /pet/multi | /pet/parasite | /pet/char | /pet/comp | /pet/murder
//   | /pet/control ?t=<token> → 控制/測試用
// ------------------------------------------------------------
// /pet/* 會改變狀態（甚至直接關掉程式），所以要驗 token：沒有的話，任何本機
// 程式——包含瀏覽器分頁用一個 no-cors 的 fetch——都能關掉使用者的寵物。
// /claude/* 只會觸發動畫，維持免 token，既有的 hooks 設定不用動。
fn token_file() -> std::path::PathBuf {
    config_dir().join("token")
}

fn control_token() -> String {
    if let Ok(s) = std::fs::read_to_string(token_file()) {
        let s = s.trim().to_string();
        if s.len() >= 32 {
            return s;
        }
    }
    let mut rng = Rng::new();
    let t = format!("{:016x}{:016x}", rng.next_u64(), rng.next_u64());
    let f = token_file();
    if let Some(dir) = f.parent() {
        let _ = std::fs::create_dir_all(dir);
    }
    let _ = std::fs::write(&f, &t);
    t
}

// 只認請求行的 "GET <path>[?<query>] HTTP/1.1"。舊版用 req.contains("/pet/quit")
// 判斷，連 Referer 之類的標頭撞到字串都會誤觸發。
fn parse_request(req: &str) -> Option<(&str, &str)> {
    let mut parts = req.lines().next()?.split(' ');
    if parts.next()? != "GET" {
        return None;
    }
    let target = parts.next()?;
    Some(match target.split_once('?') {
        Some((path, query)) => (path, query),
        None => (target, ""),
    })
}

fn query_param<'a>(query: &'a str, key: &str) -> Option<&'a str> {
    query
        .split('&')
        .filter_map(|kv| kv.split_once('='))
        .find(|(k, _)| *k == key)
        .map(|(_, v)| v)
}

fn route_control(app: &AppHandle, path: &str, query: &str, token: &str) -> (&'static str, &'static str) {
    let claude_evt = match path {
        "/claude/start" => Some("start"),
        "/claude/stop" => Some("stop"),
        "/claude/error" => Some("error"),
        "/claude/wait" => Some("wait"),
        _ => None,
    };
    if let Some(evt) = claude_evt {
        let _ = app.emit("claude-event", evt); // 廣播給所有寵物視窗
        return ("200 OK", "ok");
    }
    if !path.starts_with("/pet/") {
        return ("404 Not Found", "not found");
    }
    if query_param(query, "t") != Some(token) {
        return ("403 Forbidden", "forbidden");
    }
    match path {
        // 多人模式切換（自動化/測試用）：交給主視窗的 JS 統一管理狀態
        // （切換「有/無夥伴」：有→全收回，無→隨機召喚一位）
        "/pet/multi" => {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.emit_to("main", "pet-cmd", serde_json::json!({ "cmd": "multitest" }));
            }
            ("200 OK", "ok")
        }
        // 測試時直接走共用流程，略過前端 20 秒輪詢和 12% 機率；
        // pet_zhenmu 優先，否則 main 視窗就是目前的珍母。
        "/pet/parasite" => {
            let zhenmu = if app.get_webview_window("pet_zhenmu").is_some() {
                Some("pet_zhenmu")
            } else if app.get_webview_window("main").is_some() {
                Some("main")
            } else {
                None
            };
            if let Some(zhenmu) = zhenmu {
                let _ = try_parasite(app.clone(), zhenmu);
            }
            ("200 OK", "ok")
        }
        // 換主角（測試用）：/pet/char?id=caihua&t=<token>
        "/pet/char" => match query_param(query, "id") {
            Some(id) if CHARS.iter().any(|(k, _, _)| *k == id) => {
                if let Some(w) = app.get_webview_window("main") {
                    let _ = w.emit_to("main", "pet-cmd", serde_json::json!({ "cmd": "char", "id": id }));
                }
                ("200 OK", "ok")
            }
            _ => ("400 Bad Request", "unknown character"),
        },
        // 開關指定夥伴（測試用）：/pet/comp?id=fox&t=<token>
        "/pet/comp" => match query_param(query, "id") {
            Some(id) if CHARS.iter().any(|(k, _, _)| *k == id) => {
                if let Some(w) = app.get_webview_window("main") {
                    let _ = w.emit_to("main", "pet-cmd", serde_json::json!({ "cmd": "comp", "id": id }));
                }
                ("200 OK", "ok")
            }
            _ => ("400 Bad Request", "unknown character"),
        },
        // 強制跑一輪墓碑判定（測試用）：略過巡邏條件、機率與相遇冷卻，只保留距離判定
        // 立刻跑一輪判定。預設走「相遇必殺」；帶 &hunt=1 則改成只跑追殺導引，
        // 不用真的去選單開殺戮模式就能驗證有刀的會不會走向獵物。
        "/pet/murder" => {
            let mut rng = Rng::new();
            if query_param(query, "hunt").is_some() {
                let n = run_hunt_pass(app, &snapshot_pets(app), &[], true);
                dlog(&format!("http hunt test: guided {n}"));
            } else {
                let n = run_murder_pass(app, &mut rng, true);
                dlog(&format!("http murder test: killed {n}"));
            }
            ("200 OK", "ok")
        }
        // 操作模式：/pet/control?t=<token> 切換，加 &on=1 / &on=0 直接指定。
        // 純 toggle 很容易搞不清楚現在是開還是關（狀態存在 localStorage 會跨重啟），
        // 所以留一個可指定的入口。
        "/pet/control" => {
            if let Some(w) = app.get_webview_window("main") {
                let payload = match query_param(query, "on") {
                    Some("1") | Some("true") => serde_json::json!({ "cmd": "control", "on": true }),
                    Some("0") | Some("false") => serde_json::json!({ "cmd": "control", "on": false }),
                    _ => serde_json::json!({ "cmd": "control" }),
                };
                let _ = w.emit_to("main", "pet-cmd", payload);
            }
            ("200 OK", "ok")
        }
        // 遠端關閉（選單失效時的保險出口）
        "/pet/quit" => {
            dlog("http quit");
            quit_app(app);
            ("200 OK", "ok")
        }
        _ => ("404 Not Found", "not found"),
    }
}

fn handle_control_conn(app: AppHandle, mut s: std::net::TcpStream, token: &str) {
    use std::io::{Read, Write};
    // 讀取逾時：舊版是單執行緒同步處理且 read 沒有逾時，有人連上卻不送資料
    // 就會把後面所有 hook 請求永遠擋住。
    let _ = s.set_read_timeout(Some(Duration::from_secs(2)));
    let mut buf = [0u8; 1024];
    let n = s.read(&mut buf).unwrap_or(0);
    let req = String::from_utf8_lossy(&buf[..n]);
    let (status, body) = match parse_request(&req) {
        Some((path, query)) => route_control(&app, path, query, token),
        None => ("400 Bad Request", "bad request"),
    };
    let _ = s.write_all(
        format!(
            "HTTP/1.1 {status}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
            body.len()
        )
        .as_bytes(),
    );
}

fn spawn_claude_listener(app: AppHandle) {
    std::thread::spawn(move || {
        let listener = match std::net::TcpListener::bind("127.0.0.1:17872") {
            Ok(l) => l,
            Err(_) => return, // 埠被占（例如已有另一隻在跑）就放棄，不影響其他功能
        };
        let token = control_token();
        for stream in listener.incoming() {
            let Ok(s) = stream else { continue };
            let app = app.clone();
            let token = token.clone();
            std::thread::spawn(move || handle_control_conn(app, s, &token));
        }
    });
}

// ------------------------------------------------------------
// 打字執行緒：180ms 掃描常用鍵（取代舊版常駐 PowerShell 程序）
// ------------------------------------------------------------
fn spawn_typing_thread(app: AppHandle) {
    std::thread::spawn(move || {
        let keys: Vec<i32> = [8, 13, 32]
            .into_iter()
            .chain(48..=90)
            .chain(186..=192)
            .chain(219..=222)
            .collect();
        loop {
            std::thread::sleep(Duration::from_millis(180));
            let hit = keys
                .iter()
                .any(|&k| unsafe { GetAsyncKeyState(k) } as u16 & 1 != 0);
            if hit {
                let _ = app.emit("typing", ()); // 廣播給所有寵物視窗
            }
        }
    });
}

fn main() {
    // WebView2 瘦身：砍掉用不到的 Chromium 附屬功能與多餘程序。
    // CalculateNativeWinOcclusion 必須關：全螢幕遊戲會讓 Chromium 判定視窗被遮擋
    // 而暫停渲染，寵物就凍結了。
    std::env::set_var(
        "WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS",
        "--renderer-process-limit=1 --disable-extensions --disable-background-networking \
         --disable-breakpad --disable-component-update \
         --disable-renderer-backgrounding --disable-background-timer-throttling \
         --disable-features=SpareRendererForSitePerProcess,BackForwardCache,msSmartScreenProtection,CalculateNativeWinOcclusion",
    );
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            set_click_through,
            js_log,
            set_sleeping,
            walk,
            show_menu_window,
            sync_menu_state,
            close_menu_window,
            get_menu_state,
            get_autostart,
            set_pet_info,
            set_murder,
            set_control,
            revive,
            menu_action,
            snap_bottom,
            fit_window,
            set_companion,
            relay,
            set_toy,
            toy_grab,
            toy_menu,
            parasite_start,
            parasite_end
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                // 視窗關掉後不留舊睡眠 label，避免全域踢人評估碰到已失效的狀態。
                SLEEP_STATE.lock().unwrap().remove(window.label());
            }
            // 換到不同縮放比的螢幕：依新 DPI 重設實體尺寸，否則內容會被裁切
            if let tauri::WindowEvent::ScaleFactorChanged { .. } = event {
                if let Some(w) = window.app_handle().get_webview_window(window.label()) {
                    fix_dpi_size(&w);
                }
            }
            // 移動後節流存檔（拖曳、散步都會觸發）。時間戳必須每視窗一份：
            // 用單一全域時間戳的話，兩個視窗同時移動（例：全員巡邏）就會有一邊
            // 的存檔被對方的節流吃掉。
            if let tauri::WindowEvent::Moved(_) = event {
                let now = Instant::now();
                let mut last = MOVE_SAVED_AT.lock().unwrap();
                let due = last
                    .get(window.label())
                    .map(|at: &Instant| now.duration_since(*at) > Duration::from_millis(500))
                    .unwrap_or(true);
                if due {
                    last.insert(window.label().to_string(), now);
                    drop(last);
                    if let Some(w) = window.app_handle().get_webview_window(window.label()) {
                        save_pos(&w);
                    }
                }
            }
        })
        .setup(|app| {
            let win = app.get_webview_window("main").expect("main window");
            setup_pet_window(&win);
            spawn_cursor_thread(app.handle().clone());
            spawn_sleep_kick_evaluator(app.handle().clone());
            spawn_murder_evaluator(app.handle().clone());
            spawn_control_thread(app.handle().clone());
            spawn_typing_thread(app.handle().clone());
            spawn_claude_listener(app.handle().clone());

            // 系統匣：顯示/隱藏、開機自啟、離開
            let toggle = MenuItemBuilder::with_id("toggle", "顯示 / 隱藏").build(app)?;
            let autostart = CheckMenuItemBuilder::with_id("autostart", "開機自動啟動")
                .checked(is_autostart())
                .build(app)?;
            let quit = MenuItemBuilder::with_id("quit", "離開").build(app)?;
            let menu = MenuBuilder::new(app)
                .items(&[&toggle, &autostart, &quit])
                .build()?;
            let icon = app.default_window_icon().expect("icon").clone();
            let autostart_item = autostart.clone();
            TrayIconBuilder::new()
                .icon(icon)
                .tooltip("熱狗小夥伴")
                .menu(&menu)
                .on_menu_event(move |app, event| match event.id().as_ref() {
                    "toggle" => {
                        let vis = app
                            .get_webview_window("main")
                            .and_then(|w| w.is_visible().ok())
                            .unwrap_or(true);
                        // 寵物視窗 + 玩具視窗一起收/放
                        for (label, w) in app.webview_windows() {
                            if label == "main"
                                || label.starts_with("pet_")
                                || label.starts_with("toy_")
                            {
                                if vis {
                                    let _ = w.hide();
                                } else {
                                    let _ = w.show();
                                }
                            }
                        }
                    }
                    "autostart" => {
                        let on = !is_autostart();
                        set_autostart(on);
                        let _ = autostart_item.set_checked(on);
                    }
                    "quit" => {
                        dlog("tray quit clicked");
                        quit_app(app);
                    }
                    _ => {}
                })
                .build(app)?;

            // 右鍵彈出選單的事件（q_* 開頭＝夥伴/玩具視窗的原生選單，
            // 與系統匣分開避免重複觸發）
            app.on_menu_event(move |app, event| {
                let id = event.id().as_ref();
                // 玩具視窗選單：q_toyoff@<label> → 交主視窗 JS 收起該玩具（label 去 toy_ 前綴取 id）
                if let Some(label) = id.strip_prefix("q_toyoff@") {
                    let t = label.strip_prefix("toy_").unwrap_or(label);
                    if let Some(w) = app.get_webview_window("main") {
                        let _ = w.emit_to(
                            "main",
                            "pet-cmd",
                            serde_json::json!({ "cmd": "toyoff", "id": t }),
                        );
                    }
                    return;
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running clawd-pet");
}

#[cfg(test)]
mod tests {
    use super::*;

    // 離線驗證典型踢擊軌跡（初速 800,-700、重力 2800、scale=1）：
    // 1) 不穿出 work_area  2) ~2 秒內落地靜止  3) 彈跳 2-4 次
    #[test]
    fn kick_trajectory() {
        let left = 0.0;
        let right = 1920.0 - TOY_W; // 視窗左上角 x 上限
        let ground = 1040.0 - TOY_H; // 落地 y
        let mut p = Phys {
            x: 900.0,
            y: ground,
            vx: 800.0,
            vy: -700.0,
            grounded: false,
            grabbed: false,
            scale: 1.0,
        };
        let (mut xmin, mut xmax, mut ymax) = (p.x, p.x, p.y);
        let mut bounces = 0;
        let mut settle_tick: Option<usize> = None;
        for i in 0..600 {
            let was_air = !p.grounded;
            let prev_vy = p.vy;
            p.step(left, right, ground);
            // 彈跳：這 tick 觸地後 vy 由正(下)轉負(上)且仍在空中
            if was_air && prev_vy > 0.0 && p.vy < 0.0 && !p.grounded {
                bounces += 1;
            }
            xmin = xmin.min(p.x);
            xmax = xmax.max(p.x);
            ymax = ymax.max(p.y);
            if p.grounded && p.vx == 0.0 && settle_tick.is_none() {
                settle_tick = Some(i);
                break;
            }
        }
        let settle_s = settle_tick.expect("should settle") as f64 * TOY_DT;
        assert!(
            xmin >= left - 0.5 && xmax <= right + 0.5,
            "x 出界 [{xmin}, {xmax}] (allowed [{left}, {right}])"
        );
        assert!(ymax <= ground + 0.5, "y 穿地 {ymax} > {ground}");
        assert!((2..=4).contains(&bounces), "彈跳次數 {bounces} 不在 2..=4");
        assert!(settle_s <= 2.2, "落地靜止太慢 {settle_s}s");
    }

    // 控制埠只認請求行，且路徑要完全相符——舊版的 req.contains("/pet/quit")
    // 連標頭裡撞到字串都會誤觸發。
    #[test]
    fn request_line_parsing() {
        assert_eq!(
            parse_request("GET /claude/start HTTP/1.1\r\nHost: x\r\n\r\n"),
            Some(("/claude/start", ""))
        );
        assert_eq!(
            parse_request("GET /pet/quit?t=abc123 HTTP/1.1\r\n\r\n"),
            Some(("/pet/quit", "t=abc123"))
        );
        // 路徑在標頭裡出現不算數（只讀第一行）
        assert_eq!(
            parse_request("GET /claude/stop HTTP/1.1\r\nReferer: http://x/pet/quit\r\n\r\n"),
            Some(("/claude/stop", ""))
        );
        // 只收 GET
        assert_eq!(parse_request("POST /pet/quit HTTP/1.1\r\n\r\n"), None);
        assert_eq!(parse_request(""), None);
        assert_eq!(parse_request("garbage\r\n"), None);
    }

    #[test]
    fn query_param_lookup() {
        assert_eq!(query_param("t=abc", "t"), Some("abc"));
        assert_eq!(query_param("a=1&t=abc&b=2", "t"), Some("abc"));
        assert_eq!(query_param("a=1&b=2", "t"), None);
        assert_eq!(query_param("", "t"), None);
        // 前綴相同的參數名不該被誤認
        assert_eq!(query_param("token=abc", "t"), None);
        // 沒有 '=' 的片段直接跳過，不會 panic
        assert_eq!(query_param("t&x=1", "t"), None);
    }

    // 模擬物件在起跳螢幕的工作區內持續計算；即使實際視窗飛近另一螢幕，
    // 只要邊界維持鎖定的 Rect，物理結果就不會越牆。
    #[test]
    fn latched_work_area_keeps_toy_in_bounds() {
        let (left, right, ground) = (0.0, 1770.0, 920.0);
        let mut p = Phys {
            x: 1680.0,
            y: ground,
            vx: 1100.0,
            vy: -800.0,
            grounded: false,
            grabbed: false,
            scale: 1.0,
        };
        for _ in 0..300 {
            p.step(left, right, ground);
            assert!(
                p.x >= left - 0.5 && p.x <= right + 0.5,
                "跨出閂鎖工作區: {}",
                p.x
            );
        }
    }
}

// Clawd — 桌面小夥伴 後端
// 原則：不用全域滑鼠/鍵盤鉤子（避免拖累遊戲輸入延遲），
// 一律用便宜的原生輪詢（GetCursorPos / GetAsyncKeyState），閒置 CPU 趨近於零。
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{Duration, Instant};
use tauri::{
    menu::{CheckMenuItemBuilder, ContextMenu, MenuBuilder, MenuItemBuilder},
    tray::TrayIconBuilder,
    Emitter, Manager, PhysicalPosition, WebviewWindow,
};

#[repr(C)]
struct Point {
    x: i32,
    y: i32,
}
#[repr(C)]
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
}

const SPI_GETWORKAREA: u32 = 0x0030;
const MONITOR_DEFAULTTONEAREST: u32 = 2;

fn cursor_pos() -> (i32, i32) {
    let mut p = Point { x: 0, y: 0 };
    unsafe { GetCursorPos(&mut p) };
    (p.x, p.y)
}

fn work_area() -> Rect {
    let mut r = Rect { left: 0, top: 0, right: 1920, bottom: 1040 };
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
                rc_monitor: Rect { left: 0, top: 0, right: 0, bottom: 0 },
                rc_work: Rect { left: 0, top: 0, right: 0, bottom: 0 },
                dw_flags: 0,
            };
            if unsafe { GetMonitorInfoW(hmon, &mut mi) } != 0 {
                return mi.rc_work;
            }
        }
    }
    work_area()
}

static DRAGGING_OR_WALKING: AtomicBool = AtomicBool::new(false);

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
            reg_cmd(&["add", RUN_KEY, "/v", "ClawdPet", "/t", "REG_SZ", "/d", &d, "/f"]);
        }
    } else {
        reg_cmd(&["delete", RUN_KEY, "/v", "ClawdPet", "/f"]);
    }
}

// ------------------------------------------------------------
// 視窗位置記憶
// ------------------------------------------------------------
fn pos_file() -> std::path::PathBuf {
    let base = std::env::var("LOCALAPPDATA").unwrap_or_else(|_| ".".into());
    std::path::Path::new(&base).join("com.clawd.pet").join("pos.json")
}

fn save_pos(win: &WebviewWindow) {
    if let Ok(p) = win.outer_position() {
        if let Some(dir) = pos_file().parent() {
            let _ = std::fs::create_dir_all(dir);
        }
        let _ = std::fs::write(pos_file(), format!("{{\"x\":{},\"y\":{}}}", p.x, p.y));
    }
}

fn load_pos() -> Option<(i32, i32)> {
    let s = std::fs::read_to_string(pos_file()).ok()?;
    let v: serde_json::Value = serde_json::from_str(&s).ok()?;
    Some((v["x"].as_i64()? as i32, v["y"].as_i64()? as i32))
}

// ------------------------------------------------------------
// 指令：前端逐像素判定後切換點擊穿透
// ------------------------------------------------------------
#[tauri::command]
fn set_click_through(window: WebviewWindow, ignore: bool) {
    let _ = window.set_ignore_cursor_events(ignore);
}

// ------------------------------------------------------------
// 指令：散步。主執行緒外平滑移動視窗，回傳動畫時長（ms）
// ------------------------------------------------------------
#[tauri::command]
fn walk(window: WebviewWindow, dx: f64) -> u64 {
    if DRAGGING_OR_WALKING.swap(true, Ordering::SeqCst) {
        return 0; // 已在走或被抓著
    }
    let Ok(pos) = window.outer_position() else {
        DRAGGING_OR_WALKING.store(false, Ordering::SeqCst);
        return 0;
    };
    let Ok(size) = window.outer_size() else {
        DRAGGING_OR_WALKING.store(false, Ordering::SeqCst);
        return 0;
    };
    let wa = work_area_of(&window);
    let target = (pos.x as f64 + dx)
        .clamp(wa.left as f64, (wa.right - size.width as i32) as f64);
    let dist = (target - pos.x as f64).abs();
    if dist < 10.0 {
        DRAGGING_OR_WALKING.store(false, Ordering::SeqCst);
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
            let e = if t < 0.5 { 2.0 * t * t } else { 1.0 - (-2.0 * t + 2.0).powi(2) / 2.0 };
            let x = start_x + (target - start_x) * e;
            let _ = window.set_position(PhysicalPosition::new(x as i32, y));
            std::thread::sleep(step);
        }
        DRAGGING_OR_WALKING.store(false, Ordering::SeqCst);
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
fn stat_bar(v: i32) -> String {
    let filled = ((v.clamp(0, 100) + 10) / 20).clamp(0, 5) as usize;
    format!("{}{}  {}", "■".repeat(filled), "□".repeat(5 - filled), v)
}

#[tauri::command]
fn show_menu(window: WebviewWindow, mood: i32, fullness: i32, patrol: bool) {
    let win = window.clone();
    let _ = window.run_on_main_thread(move || {
        let app = win.app_handle();
        let stat_mood = MenuItemBuilder::with_id("p_s1", format!("心情　　{}", stat_bar(mood)))
            .enabled(false)
            .build(app);
        let stat_full = MenuItemBuilder::with_id("p_s2", format!("飽食度　{}", stat_bar(fullness)))
            .enabled(false)
            .build(app);
        let feed = MenuItemBuilder::with_id("p_feed", "餵熱狗").build(app);
        let patrol_item = CheckMenuItemBuilder::with_id("p_patrol", "巡邏模式")
            .checked(patrol)
            .build(app);
        let hide = MenuItemBuilder::with_id("p_hide", "躲起來（系統匣可叫回）").build(app);
        let home = MenuItemBuilder::with_id("p_home", "回到主螢幕右下角").build(app);
        let auto = CheckMenuItemBuilder::with_id("p_autostart", "開機自動啟動")
            .checked(is_autostart())
            .build(app);
        let quit = MenuItemBuilder::with_id("p_quit", "離開").build(app);
        if let (Ok(s1), Ok(s2), Ok(feed), Ok(patrol_item), Ok(hide), Ok(home), Ok(auto), Ok(quit)) =
            (stat_mood, stat_full, feed, patrol_item, hide, home, auto, quit)
        {
            if let Ok(menu) = MenuBuilder::new(app)
                .items(&[&s1, &s2])
                .separator()
                .items(&[&feed, &patrol_item])
                .separator()
                .items(&[&hide, &home, &auto, &quit])
                .build()
            {
                let _ = menu.popup(win.as_ref().window());
            }
        }
    });
}

// ------------------------------------------------------------
// 游標執行緒：60ms 輪詢，把「相對視窗」座標丟給前端
// 前端做逐像素命中 → 再回呼 set_click_through
// ------------------------------------------------------------
fn spawn_cursor_thread(win: WebviewWindow) {
    std::thread::spawn(move || {
        let mut last: (i32, i32) = (i32::MIN, i32::MIN);
        loop {
            std::thread::sleep(Duration::from_millis(60));
            let (cx, cy) = cursor_pos();
            let (Ok(pos), Ok(size)) = (win.outer_position(), win.outer_size()) else {
                continue;
            };
            let rx = cx - pos.x;
            let ry = cy - pos.y;
            let near = rx > -400
                && ry > -400
                && rx < size.width as i32 + 400
                && ry < size.height as i32 + 400;
            // 游標離很遠且沒在動就不吵前端
            if !near && (cx, cy) == last {
                continue;
            }
            last = (cx, cy);
            let _ = win.emit("cursor", serde_json::json!({ "x": rx, "y": ry }));
        }
    });
}

// ------------------------------------------------------------
// Claude Code 連動：本機 HTTP 監聽（hooks 用 curl 敲）
// GET /claude/start | /claude/stop | /claude/error → 轉發給前端
// ------------------------------------------------------------
fn spawn_claude_listener(win: WebviewWindow) {
    std::thread::spawn(move || {
        use std::io::{Read, Write};
        let listener = match std::net::TcpListener::bind("127.0.0.1:17872") {
            Ok(l) => l,
            Err(_) => return, // 埠被占（例如已有另一隻在跑）就放棄，不影響其他功能
        };
        for stream in listener.incoming() {
            let Ok(mut s) = stream else { continue };
            let mut buf = [0u8; 512];
            let n = s.read(&mut buf).unwrap_or(0);
            let req = String::from_utf8_lossy(&buf[..n]);
            let evt = if req.contains("/claude/start") {
                "start"
            } else if req.contains("/claude/stop") {
                "stop"
            } else if req.contains("/claude/error") {
                "error"
            } else {
                ""
            };
            if !evt.is_empty() {
                let _ = win.emit("claude-event", evt);
            }
            let _ = s.write_all(b"HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: close\r\n\r\nok");
        }
    });
}

// ------------------------------------------------------------
// 打字執行緒：180ms 掃描常用鍵（取代舊版常駐 PowerShell 程序）
// ------------------------------------------------------------
fn spawn_typing_thread(win: WebviewWindow) {
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
                let _ = win.emit("typing", ());
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
            walk,
            show_menu,
            snap_bottom
        ])
        .on_window_event(|window, event| {
            // 移動後節流存檔（拖曳、散步都會觸發）
            if let tauri::WindowEvent::Moved(_) = event {
                use std::sync::atomic::AtomicU64;
                static LAST: AtomicU64 = AtomicU64::new(0);
                let now = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .map(|d| d.as_millis() as u64)
                    .unwrap_or(0);
                if now.saturating_sub(LAST.load(Ordering::Relaxed)) > 500 {
                    LAST.store(now, Ordering::Relaxed);
                    if let Some(w) = window.app_handle().get_webview_window("main") {
                        save_pos(&w);
                    }
                }
            }
        })
        .setup(|app| {
            let win = app.get_webview_window("main").expect("main window");

            // 初始位置：上次記住的位置；沒有就放工作區右下角（不遮工作列）
            if let Some((x, y)) = load_pos() {
                let _ = win.set_position(PhysicalPosition::new(x, y));
            } else {
                let wa = work_area();
                let size = win.outer_size()?;
                let _ = win.set_position(PhysicalPosition::new(
                    wa.right - size.width as i32 - 32,
                    wa.bottom - size.height as i32 - 8,
                ));
            }
            // 預設穿透，由前端逐像素判定後接管
            let _ = win.set_ignore_cursor_events(true);

            spawn_cursor_thread(win.clone());
            spawn_typing_thread(win.clone());
            spawn_claude_listener(win.clone());

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
                        if let Some(w) = app.get_webview_window("main") {
                            if w.is_visible().unwrap_or(true) {
                                let _ = w.hide();
                            } else {
                                let _ = w.show();
                            }
                        }
                    }
                    "autostart" => {
                        let on = !is_autostart();
                        set_autostart(on);
                        let _ = autostart_item.set_checked(on);
                    }
                    "quit" => {
                        if let Some(w) = app.get_webview_window("main") {
                            save_pos(&w);
                        }
                        app.exit(0);
                    }
                    _ => {}
                })
                .build(app)?;

            // 右鍵彈出選單的事件（p_* 開頭，與系統匣分開避免重複觸發）
            let tray_auto = autostart.clone();
            app.on_menu_event(move |app, event| match event.id().as_ref() {
                "p_hide" => {
                    if let Some(w) = app.get_webview_window("main") {
                        let _ = w.hide();
                    }
                }
                "p_home" => {
                    if let Some(w) = app.get_webview_window("main") {
                        let wa = work_area();
                        if let Ok(s) = w.outer_size() {
                            let _ = w.set_position(PhysicalPosition::new(
                                wa.right - s.width as i32 - 32,
                                wa.bottom - s.height as i32 - 8,
                            ));
                            save_pos(&w);
                        }
                    }
                }
                "p_feed" => {
                    if let Some(w) = app.get_webview_window("main") {
                        let _ = w.emit("pet-cmd", "feed");
                    }
                }
                "p_patrol" => {
                    if let Some(w) = app.get_webview_window("main") {
                        let _ = w.emit("pet-cmd", "patrol");
                    }
                }
                "p_autostart" => {
                    let on = !is_autostart();
                    set_autostart(on);
                    let _ = tray_auto.set_checked(on);
                }
                "p_quit" => {
                    if let Some(w) = app.get_webview_window("main") {
                        save_pos(&w);
                    }
                    app.exit(0);
                }
                _ => {}
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running clawd-pet");
}

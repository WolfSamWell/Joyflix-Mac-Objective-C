#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

#[derive(Debug, Serialize, Deserialize, Clone)]
struct HistoryItem {
    name: String,
    url: String,
    time: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct Config {
    custom_sites: Vec<Site>,
    last_url: String,
    auto_open: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct Site {
    name: String,
    url: String,
}

fn get_app_dir() -> PathBuf {
    let dir = dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("Joyflix");
    fs::create_dir_all(&dir).ok();
    dir
}

#[tauri::command]
fn load_history() -> Result<Vec<HistoryItem>, String> {
    let path = get_app_dir().join("history.json");
    if !path.exists() {
        return Ok(vec![]);
    }
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let history: Vec<HistoryItem> = serde_json::from_str(&content).unwrap_or_default();
    Ok(history)
}

#[tauri::command]
fn save_history(data: Vec<HistoryItem>) -> Result<(), String> {
    let path = get_app_dir().join("history.json");
    let content = serde_json::to_string_pretty(&data).map_err(|e| e.to_string())?;
    fs::write(&path, content).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn load_config() -> Result<Config, String> {
    let path = get_app_dir().join("config.json");
    if !path.exists() {
        return Ok(Config {
            custom_sites: vec![],
            last_url: String::from("https://www.dandantu.cc/"),
            auto_open: false,
        });
    }
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let config: Config = serde_json::from_str(&content).map_err(|e| e.to_string())?;
    Ok(config)
}

#[tauri::command]
fn save_config(config: Config) -> Result<(), String> {
    let path = get_app_dir().join("config.json");
    let content = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    fs::write(&path, content).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn clear_history() -> Result<(), String> {
    let path = get_app_dir().join("history.json");
    if path.exists() {
        fs::remove_file(&path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn open_site(app: tauri::AppHandle, url: String, _title: String) -> Result<(), String> {
    // 获取可用窗口 - 优先使用 main，否则查找任何可用窗口
    let window = app.get_webview_window("main")
        .or_else(|| {
            // 查找任何可用的窗口
            app.webview_windows().into_values().next()
        })
        .ok_or("找不到可用窗口")?;
    
    window.navigate(url.parse().map_err(|e: url::ParseError| e.to_string())?).map_err(|e| e.to_string())?;
    
    // 多次注入弹窗拦截脚本，覆盖页面加载的各个阶段
    let window_clone = window.clone();
    tauri::async_runtime::spawn(async move {
        // 在页面加载的不同阶段多次注入
        let delays = [300, 800, 1500, 3000, 5000];
        for delay in delays {
            tokio::time::sleep(tokio::time::Duration::from_millis(delay)).await;
            inject_popup_blocker(&window_clone);
        }
    });
    
    Ok(())
}

fn inject_popup_blocker(window: &tauri::WebviewWindow) {
    let popup_blocker = r#"
        (function() {
            if (window._joyflixPopupBlockerInstalled) return;
            window._joyflixPopupBlockerInstalled = true;
            
            // 立即禁用 window.open - 使用 Object.defineProperty 防止被覆盖
            try {
                Object.defineProperty(window, 'open', {
                    value: function() { return null; },
                    writable: false,
                    configurable: false
                });
            } catch(e) {
                window.open = function() { return null; };
            }
            
            // 禁用 alert/confirm/prompt 可能导致的弹窗
            window.alert = function(msg) { console.log('[Joyflix] 拦截 alert:', msg); };
            window.confirm = function() { return false; };
            window.prompt = function() { return null; };
            
            // 移除所有 target="_blank" 属性
            function removeBlankTargets() {
                var links = document.querySelectorAll('a[target="_blank"]');
                for (var i = 0; i < links.length; i++) {
                    links[i].removeAttribute('target');
                }
            }
            
            // 立即执行一次
            if (document.body) removeBlankTargets();
            
            // 监听 DOM 变化，移除新添加的 target="_blank"
            var observer = new MutationObserver(removeBlankTargets);
            if (document.body) {
                observer.observe(document.body, { childList: true, subtree: true });
            } else {
                document.addEventListener('DOMContentLoaded', function() {
                    removeBlankTargets();
                    observer.observe(document.body, { childList: true, subtree: true });
                });
            }
            
            // 阻止所有可能导致新窗口的点击
            document.addEventListener('click', function(e) {
                var target = e.target;
                while (target && target.tagName !== 'A') {
                    target = target.parentElement;
                }
                if (target && target.tagName === 'A') {
                    // 移除 target 属性
                    if (target.target === '_blank') {
                        e.preventDefault();
                        e.stopPropagation();
                        var href = target.href;
                        if (href && href !== '#' && !href.startsWith('javascript:')) {
                            window.location.href = href;
                        }
                        return false;
                    }
                }
            }, true);
            
            // 阻止 Ctrl+点击 和 中键点击
            document.addEventListener('auxclick', function(e) {
                e.preventDefault();
                e.stopPropagation();
                return false;
            }, true);
            
            console.log('[Joyflix] 强化弹窗拦截器已激活');
        })();
    "#;
    window.eval(popup_blocker).ok();
}

#[tauri::command]
async fn go_home(app: tauri::AppHandle) -> Result<(), String> {
    // 返回主页 - 打开新窗口，用户手动关闭旧窗口
    use std::time::{SystemTime, UNIX_EPOCH};
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_millis();
    let window_label = format!("home_{}", timestamp);
    
    tauri::WebviewWindowBuilder::new(
        &app,
        &window_label,
        tauri::WebviewUrl::App("index.html".into())
    )
    .title("Joyflix - 首页")
    .inner_size(1280.0, 800.0)
    .build()
    .map_err(|e| e.to_string())?;
    
    Ok(())
}

#[tauri::command]
async fn toggle_fullscreen(app: tauri::AppHandle, enter: bool) -> Result<(), String> {
    let main_window = app.get_webview_window("main").ok_or("找不到主窗口")?;
    if enter {
        // 进入全屏模式 - 只隐藏菜单栏
        main_window.hide_menu().map_err(|e| e.to_string())?;
    } else {
        // 退出全屏模式 - 显示菜单栏
        main_window.show_menu().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn exit_fullscreen(app: tauri::AppHandle) -> Result<(), String> {
    let main_window = app.get_webview_window("main").ok_or("找不到主窗口")?;
    main_window.set_fullscreen(false).map_err(|e| e.to_string())?;
    main_window.show_menu().map_err(|e| e.to_string())?;
    Ok(())
}

fn main() {
    use tauri::menu::{MenuBuilder, MenuItemBuilder};
    use tauri::Manager;

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            load_history,
            save_history,
            load_config,
            save_config,
            clear_history,
            open_site,
            go_home,
            toggle_fullscreen,
            exit_fullscreen
        ])
        .setup(|app| {
            // 创建菜单项
            let home_item = MenuItemBuilder::with_id("home", "🏠 返回首页")
                .accelerator("CmdOrCtrl+H")
                .build(app)?;

            let back_item = MenuItemBuilder::with_id("back", "⬅️ 上一页")
                .accelerator("Alt+Left")
                .build(app)?;

            let forward_item = MenuItemBuilder::with_id("forward", "➡️ 下一页")
                .accelerator("Alt+Right")
                .build(app)?;

            let refresh_item = MenuItemBuilder::with_id("refresh", "🔄 刷新页面")
                .accelerator("CmdOrCtrl+R")
                .build(app)?;

            let fullscreen_item = MenuItemBuilder::with_id("fullscreen", "📺 全屏模式")
                .accelerator("F11")
                .build(app)?;

            // 创建菜单
            let menu = MenuBuilder::new(app)
                .item(&home_item)
                .item(&back_item)
                .item(&forward_item)
                .item(&refresh_item)
                .item(&fullscreen_item)
                .build()?;

            // 获取主窗口并设置菜单
            let main_window = app.get_webview_window("main").unwrap();
            main_window.set_menu(menu)?;

            // 注入弹窗拦截脚本 - 阻止 window.open 导致的卡死
            let popup_blocker = r#"
                (function() {
                    // 拦截 window.open 弹窗
                    window._originalOpen = window.open;
                    window.open = function(url, name, specs) {
                        console.log('[Joyflix] 已拦截弹窗:', url);
                        // 如果是同域链接，在当前窗口打开
                        if (url && (url.startsWith('/') || url.startsWith(window.location.origin))) {
                            window.location.href = url;
                        }
                        return null;
                    };
                    
                    // 阻止 target="_blank" 的链接
                    document.addEventListener('click', function(e) {
                        var target = e.target;
                        while (target && target.tagName !== 'A') {
                            target = target.parentElement;
                        }
                        if (target && target.tagName === 'A' && target.target === '_blank') {
                            e.preventDefault();
                            e.stopPropagation();
                            var href = target.href;
                            if (href && href !== '#' && !href.startsWith('javascript:')) {
                                window.location.href = href;
                            }
                        }
                    }, true);
                    
                    console.log('[Joyflix] 弹窗拦截器已激活');
                })();
            "#;
            main_window.eval(popup_blocker).ok();

            Ok(())
        })
        .on_menu_event(|app, event| {
            use tauri::Manager;
            match event.id().as_ref() {
                "home" => {
                    // 打开新窗口到首页，用户手动关闭旧窗口
                    use std::time::{SystemTime, UNIX_EPOCH};
                    let timestamp = SystemTime::now()
                        .duration_since(UNIX_EPOCH)
                        .unwrap()
                        .as_millis();
                    let window_label = format!("home_{}", timestamp);
                    
                    tauri::WebviewWindowBuilder::new(
                        app,
                        &window_label,
                        tauri::WebviewUrl::App("index.html".into())
                    )
                    .title("Joyflix - 首页")
                    .inner_size(1280.0, 800.0)
                    .build()
                    .ok();
                }
                "back" => {
                    if let Some(window) = app.get_webview_window("main") {
                        // 使用 JavaScript 的 history.back()，并判断是否可以后退
                        window.eval("if (window.history.length > 1) { window.history.back(); }").ok();
                    }
                }
                "forward" => {
                    if let Some(window) = app.get_webview_window("main") {
                        // 使用 JavaScript 的 history.forward()
                        window.eval("window.history.forward();").ok();
                    }
                }
                "refresh" => {
                    if let Some(window) = app.get_webview_window("main") {
                        window.eval("location.reload()").ok();
                    }
                }
                "fullscreen" => {
                    if let Some(window) = app.get_webview_window("main") {
                        // 切换全屏状态
                        let is_fullscreen = window.is_fullscreen().unwrap_or(false);
                        if is_fullscreen {
                            // 退出全屏，显示菜单
                            window.set_fullscreen(false).ok();
                            window.show_menu().ok();
                        } else {
                            // 进入全屏，隐藏菜单
                            window.hide_menu().ok();
                            window.set_fullscreen(true).ok();
                            // 注入 ESC 键监听来退出全屏
                            window.eval(r#"
                                if (!window._escListenerAdded) {
                                    window._escListenerAdded = true;
                                    document.addEventListener('keydown', function(e) {
                                        if (e.key === 'Escape') {
                                            if (window.__TAURI__ && window.__TAURI__.core) {
                                                window.__TAURI__.core.invoke('exit_fullscreen');
                                            }
                                        }
                                    });
                                }
                            "#).ok();
                        }
                    }
                }
                _ => {}
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

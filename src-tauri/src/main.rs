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
    // 获取主窗口，直接导航到目标URL
    let main_window = app.get_webview_window("main").ok_or("找不到主窗口")?;
    main_window.navigate(url.parse().map_err(|e: url::ParseError| e.to_string())?).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn go_home(app: tauri::AppHandle) -> Result<(), String> {
    // 返回主页（站点选择页面）
    let main_window = app.get_webview_window("main").ok_or("找不到主窗口")?;
    main_window.navigate("http://tauri.localhost/".parse().unwrap()).map_err(|e| e.to_string())?;
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
            go_home
        ])
        .setup(|app| {
            // 创建菜单项
            let home_item = MenuItemBuilder::with_id("home", "🏠 返回首页")
                .accelerator("CmdOrCtrl+H")
                .build(app)?;

            let refresh_item = MenuItemBuilder::with_id("refresh", "🔄 刷新页面")
                .accelerator("CmdOrCtrl+R")
                .build(app)?;

            // 创建菜单
            let menu = MenuBuilder::new(app)
                .item(&home_item)
                .item(&refresh_item)
                .build()?;

            // 设置菜单到主窗口
            let main_window = app.get_webview_window("main").unwrap();
            main_window.set_menu(menu)?;

            Ok(())
        })
        .on_menu_event(|app, event| {
            use tauri::Manager;
            match event.id().as_ref() {
                "home" => {
                    if let Some(window) = app.get_webview_window("main") {
                        window.navigate("http://tauri.localhost/".parse().unwrap()).ok();
                    }
                }
                "refresh" => {
                    if let Some(window) = app.get_webview_window("main") {
                        window.eval("location.reload()").ok();
                    }
                }
                _ => {}
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

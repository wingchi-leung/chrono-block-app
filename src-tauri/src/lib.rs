// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod db;
mod models;

use tauri::{
    image::Image,
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let pool = tauri::async_runtime::block_on(db::init_pool(&app.handle()))?;
            app.manage(pool);

            let app_icon_bytes = include_bytes!("../icons/icon.png");

            if let Some(window) = app.get_webview_window("main") {
                let window_icon = Image::from_bytes(app_icon_bytes)
                    .map_err(|e| format!("加载窗口图标失败: {}", e))?;
                let _ = window.set_icon(window_icon);
            }

            let tray_icon = Image::from_bytes(app_icon_bytes)
                .map_err(|e| format!("加载托盘图标失败: {}", e))?;

            TrayIconBuilder::new()
                .tooltip("ChronoBlock")
                .icon(tray_icon)
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        if let Some(window) = tray.app_handle().get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.unminimize();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)
                .map_err(|e| format!("创建系统托盘失败: {}", e))?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            db::get_tasks,
            db::get_task,
            db::create_task,
            db::update_task,
            db::delete_task,
            db::get_projects,
            db::create_project,
            db::get_time_blocks,
            db::get_time_block,
            db::create_time_block,
            db::update_time_block,
            db::delete_time_block,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

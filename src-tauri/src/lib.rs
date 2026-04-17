mod models;
mod storage;

use tauri::Manager;
use storage::{
    add_message, clear_messages, close_toast_window, get_messages, get_storage_meta, get_toast_payload,
    load_app_state, open_storage_path, quit_app, resolve_storage_dir, save_config, set_storage_path,
    show_custom_toast, show_main_window, toggle_favorite, AppState,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            let (storage_dir, storage_locked_by_env, preference_path) =
                resolve_storage_dir(app.handle()).map_err(|error| error.to_string())?;
            app.manage(AppState::new(
                storage_dir,
                storage_locked_by_env,
                preference_path,
            ));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            load_app_state,
            save_config,
            get_messages,
            add_message,
            clear_messages,
            toggle_favorite,
            get_storage_meta,
            set_storage_path,
            open_storage_path,
            quit_app,
            show_main_window,
            show_custom_toast,
            close_toast_window,
            get_toast_payload,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

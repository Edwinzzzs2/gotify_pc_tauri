use crate::models::{Config, InitialAppState, MessageItem, StorageChange, StorageMeta};
use std::collections::HashMap;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::Mutex;
use tauri::{AppHandle, Manager, Monitor, PhysicalPosition, State, WebviewUrl, WebviewWindowBuilder};

const MAX_MESSAGES: usize = 1000;
const TOAST_WIDTH: f64 = 344.0;
const TOAST_HEIGHT: f64 = 88.0;
const TOAST_MARGIN_RIGHT: f64 = 18.0;
const TOAST_MARGIN_BOTTOM: f64 = 18.0;
const TOAST_GAP: f64 = 10.0;
const MAX_TOAST_WINDOWS: usize = 5;
const TOAST_WINDOW_PREFIX: &str = "toast-";
pub struct AppState {
    storage_dir: Mutex<PathBuf>,
    storage_locked_by_env: bool,
    preference_path: PathBuf,
    pending_toasts: Mutex<HashMap<String, ToastPayload>>,
}

#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToastPayload {
    pub id: String,
    pub title: String,
    pub subtitle: String,
    pub body: String,
    pub verification_code: Option<String>,
    pub duration: u64,
    pub theme_mode: Option<String>,
}

impl AppState {
    pub fn new(storage_dir: PathBuf, storage_locked_by_env: bool, preference_path: PathBuf) -> Self {
        Self {
            storage_dir: Mutex::new(storage_dir),
            storage_locked_by_env,
            preference_path,
            pending_toasts: Mutex::new(HashMap::new()),
        }
    }

    fn current_storage_dir(&self) -> PathBuf {
        self.storage_dir.lock().expect("storage dir lock poisoned").clone()
    }

    fn set_storage_dir(&self, next_path: PathBuf) {
        let mut storage_dir = self.storage_dir.lock().expect("storage dir lock poisoned");
        *storage_dir = next_path;
    }
}

pub fn resolve_storage_dir(app: &AppHandle) -> io::Result<(PathBuf, bool, PathBuf)> {
    let config_dir = app
        .path()
        .app_config_dir()
        .map_err(|error| io::Error::new(io::ErrorKind::Other, error.to_string()))?;
    fs::create_dir_all(&config_dir)?;
    let preference_path = config_dir.join("storage-preferences.json");

    let env_path = std::env::var("GOTIFY_DATA_DIR").unwrap_or_default().trim().to_string();
    if !env_path.is_empty() {
        let resolved = ensure_writable_dir(PathBuf::from(env_path))?;
        return Ok((resolved, true, preference_path));
    }

    let mut candidates = Vec::new();
    if let Some(preferred) = read_preferred_storage_dir(&preference_path) {
        candidates.push(PathBuf::from(preferred));
    }

    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            if exe_dir.join("config.json").exists() {
                candidates.push(exe_dir.to_path_buf());
            }
        }
    }

    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| io::Error::new(io::ErrorKind::Other, error.to_string()))?;
    candidates.push(app_data_dir);

    for candidate in candidates {
        if let Ok(dir) = ensure_writable_dir(candidate) {
            return Ok((dir, false, preference_path));
        }
    }

    let fallback = ensure_writable_dir(std::env::current_dir()?)?;
    Ok((fallback, false, preference_path))
}

fn read_preferred_storage_dir(preference_path: &Path) -> Option<String> {
    let raw = fs::read_to_string(preference_path).ok()?;
    let json: serde_json::Value = serde_json::from_str(&raw).ok()?;
    Some(json.get("storageDir")?.as_str()?.trim().to_string()).filter(|value| !value.is_empty())
}

fn save_preferred_storage_dir(preference_path: &Path, next_path: &Path) -> io::Result<()> {
    if let Some(parent) = preference_path.parent() {
        fs::create_dir_all(parent)?;
    }
    let json = serde_json::json!({ "storageDir": next_path.to_string_lossy() });
    fs::write(preference_path, serde_json::to_string_pretty(&json).unwrap_or_else(|_| "{}".into()))
}

fn ensure_writable_dir(path: PathBuf) -> io::Result<PathBuf> {
    fs::create_dir_all(&path)?;
    let probe = path.join(".gotify-write-test");
    fs::write(&probe, b"ok")?;
    let _ = fs::remove_file(&probe);
    Ok(path)
}

fn config_path(storage_dir: &Path) -> PathBuf {
    storage_dir.join("config.json")
}

fn history_path(storage_dir: &Path) -> PathBuf {
    storage_dir.join("message_history.json")
}

fn read_config(storage_dir: &Path) -> Config {
    let path = config_path(storage_dir);
    fs::read_to_string(path)
        .ok()
        .and_then(|raw| serde_json::from_str::<Config>(&raw).ok())
        .unwrap_or_default()
}

fn write_config(storage_dir: &Path, config: &Config) -> Result<(), String> {
    let path = config_path(storage_dir);
    fs::write(path, serde_json::to_string_pretty(config).map_err(|error| error.to_string())?)
        .map_err(|error| error.to_string())
}

fn deduplicate_messages(messages: Vec<MessageItem>) -> Vec<MessageItem> {
    let mut deduped = Vec::new();
    let mut seen_ids = std::collections::HashSet::new();
    for item in messages {
        let item_id = item.id.unwrap_or_default();
        if item_id > 0 {
            if seen_ids.contains(&item_id) {
                continue;
            }
            seen_ids.insert(item_id);
        }
        deduped.push(item);
        if deduped.len() >= MAX_MESSAGES {
            break;
        }
    }
    deduped
}

fn read_messages(storage_dir: &Path) -> Vec<MessageItem> {
    let path = history_path(storage_dir);
    let messages = fs::read_to_string(path)
        .ok()
        .and_then(|raw| serde_json::from_str::<Vec<MessageItem>>(&raw).ok())
        .unwrap_or_default();
    deduplicate_messages(messages)
}

fn write_messages(storage_dir: &Path, messages: &[MessageItem]) -> Result<(), String> {
    let path = history_path(storage_dir);
    fs::write(path, serde_json::to_string_pretty(messages).map_err(|error| error.to_string())?)
        .map_err(|error| error.to_string())
}

fn copy_data_files(source_dir: &Path, target_dir: &Path) -> Result<(), String> {
    for file_name in ["config.json", "message_history.json"] {
        let source = source_dir.join(file_name);
        let target = target_dir.join(file_name);
        if source.exists() && !target.exists() {
            fs::copy(source, target).map_err(|error| error.to_string())?;
        }
    }
    Ok(())
}

fn toast_window_position(monitor: Option<Monitor>) -> (i32, i32, i32) {
    if let Some(monitor) = monitor {
        let scale = monitor.scale_factor();
        let work_area = monitor.work_area();
        let toast_width = (TOAST_WIDTH * scale).round() as i32;
        let toast_height = (TOAST_HEIGHT * scale).round() as i32;
        let margin_right = (TOAST_MARGIN_RIGHT * scale).round() as i32;
        let margin_bottom = (TOAST_MARGIN_BOTTOM * scale).round() as i32;
        let toast_gap = (TOAST_GAP * scale).round() as i32;
        let x = work_area.position.x + work_area.size.width as i32 - toast_width - margin_right;
        let y = work_area.position.y + work_area.size.height as i32 - toast_height - margin_bottom;
        return (x, y, toast_height + toast_gap);
    }

    (100, 100, (TOAST_HEIGHT + TOAST_GAP) as i32)
}

fn resolve_toast_monitor(app: &AppHandle) -> Option<Monitor> {
    app.primary_monitor().ok().flatten()
        .or_else(|| app.available_monitors().ok().into_iter().flatten().next())
}

fn active_toast_labels(app: &AppHandle) -> Vec<String> {
    app
        .webview_windows()
        .keys()
        .filter(|label| label.starts_with(TOAST_WINDOW_PREFIX))
        .cloned()
        .collect()
}

fn reposition_toast_windows(app: &AppHandle) {
    let monitor = resolve_toast_monitor(app);
    let mut windows: Vec<(String, i32)> = active_toast_labels(app)
        .into_iter()
        .filter_map(|label| {
            let window = app.get_webview_window(&label)?;
            let y = window.outer_position().ok().map(|pos| pos.y).unwrap_or(i32::MIN);
            Some((label, y))
        })
        .collect();
    windows.sort_by(|a, b| b.1.cmp(&a.1));
    for (index, (label, _)) in windows.iter().enumerate() {
        if let Some(window) = app.get_webview_window(label) {
            let (base_x, base_y, step) = toast_window_position(monitor.clone());
            let y = base_y - (step * index as i32);
            let _ = window.set_position(PhysicalPosition::new(base_x, y));
        }
    }
}

#[tauri::command]
pub fn load_app_state(state: State<AppState>) -> Result<InitialAppState, String> {
    let storage_dir = state.current_storage_dir();
    Ok(InitialAppState {
        config: Some(read_config(&storage_dir)),
        messages: Some(read_messages(&storage_dir)),
        storage: Some(StorageMeta {
            path: Some(storage_dir.to_string_lossy().to_string()),
            locked_by_env: Some(state.storage_locked_by_env),
        }),
    })
}

#[tauri::command]
pub fn save_config(config: Config, state: State<AppState>) -> Result<Config, String> {
    let storage_dir = state.current_storage_dir();
    write_config(&storage_dir, &config)?;
    Ok(config)
}

#[tauri::command]
pub fn get_messages(state: State<AppState>) -> Result<Vec<MessageItem>, String> {
    Ok(read_messages(&state.current_storage_dir()))
}

#[tauri::command]
pub fn add_message(message: MessageItem, state: State<AppState>) -> Result<(), String> {
    let storage_dir = state.current_storage_dir();
    let mut messages = read_messages(&storage_dir);
    let incoming_id = message.id.unwrap_or_default();
    let exists = incoming_id > 0 && messages.iter().any(|item| item.id.unwrap_or_default() == incoming_id);
    if exists {
        return Ok(());
    }
    messages.insert(0, message);
    if messages.len() > MAX_MESSAGES {
        messages.truncate(MAX_MESSAGES);
    }
    write_messages(&storage_dir, &messages)
}

#[tauri::command]
pub fn clear_messages(state: State<AppState>) -> Result<(), String> {
    write_messages(&state.current_storage_dir(), &[])
}

#[tauri::command]
pub fn toggle_favorite(id: i64, state: State<AppState>) -> Result<bool, String> {
    let storage_dir = state.current_storage_dir();
    let mut messages = read_messages(&storage_dir);
    let mut next_favorite = false;
    for message in &mut messages {
        if message.id.unwrap_or_default() == id {
            let current = message.favorite.unwrap_or(false);
            message.favorite = Some(!current);
            next_favorite = !current;
            break;
        }
    }
    write_messages(&storage_dir, &messages)?;
    Ok(next_favorite)
}

#[tauri::command]
pub fn get_storage_meta(state: State<AppState>) -> Result<StorageMeta, String> {
    Ok(StorageMeta {
        path: Some(state.current_storage_dir().to_string_lossy().to_string()),
        locked_by_env: Some(state.storage_locked_by_env),
    })
}

#[tauri::command]
pub fn set_storage_path(next_path: String, state: State<AppState>) -> Result<StorageChange, String> {
    if state.storage_locked_by_env {
        return Err("检测到 GOTIFY_DATA_DIR 已设置，无法在界面修改路径".into());
    }

    let normalized = PathBuf::from(next_path.trim());
    if next_path.trim().is_empty() {
        return Err("存储路径不能为空".into());
    }
    let target_dir = ensure_writable_dir(normalized).map_err(|error| error.to_string())?;
    let current_dir = state.current_storage_dir();
    copy_data_files(&current_dir, &target_dir)?;
    save_preferred_storage_dir(&state.preference_path, &target_dir).map_err(|error| error.to_string())?;
    let changed = current_dir != target_dir;
    state.set_storage_dir(target_dir.clone());
    Ok(StorageChange {
        changed: Some(changed),
        path: Some(target_dir.to_string_lossy().to_string()),
        restart_required: Some(changed),
    })
}

#[tauri::command]
pub fn open_storage_path(state: State<AppState>) -> Result<(), String> {
    let target = state.current_storage_dir();
    #[cfg(target_os = "windows")]
    let mut command = {
        let mut cmd = Command::new("explorer");
        cmd.arg(target);
        cmd
    };
    #[cfg(target_os = "macos")]
    let mut command = {
        let mut cmd = Command::new("open");
        cmd.arg(target);
        cmd
    };
    #[cfg(all(not(target_os = "windows"), not(target_os = "macos")))]
    let mut command = {
        let mut cmd = Command::new("xdg-open");
        cmd.arg(target);
        cmd
    };
    command.spawn().map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn quit_app(app: AppHandle) -> Result<(), String> {
    app.exit(0);
    Ok(())
}

#[tauri::command]
pub fn show_main_window(app: AppHandle) -> Result<(), String> {
    let main_window = app
        .get_webview_window("main")
        .ok_or_else(|| "main window not found".to_string())?;
    let _ = main_window.unminimize();
    main_window.show().map_err(|error| error.to_string())?;
    main_window.set_focus().map_err(|error| error.to_string())?;
    Ok(())
}
#[tauri::command]
pub async fn show_custom_toast(app: AppHandle, state: State<'_, AppState>, toast: ToastPayload) -> Result<(), String> {
    let active = active_toast_labels(&app);
    if active.len() >= MAX_TOAST_WINDOWS {
        if let Some(oldest_label) = active.first() {
            if let Some(oldest_win) = app.get_webview_window(oldest_label) {
                let _ = oldest_win.close();
            }
        }
        std::thread::sleep(std::time::Duration::from_millis(50));
    }

    let label = format!("{}{}", TOAST_WINDOW_PREFIX, toast.id.replace(['-', '.'], "_"));
    let slot = active_toast_labels(&app).len();
    let (base_x, base_y, step) = toast_window_position(resolve_toast_monitor(&app));
    let y = base_y - (step * slot as i32);

    let window = WebviewWindowBuilder::new(&app, &label, WebviewUrl::App("index.html".into()))
        .title("Gotify Toast")
        .inner_size(TOAST_WIDTH, TOAST_HEIGHT)
        .position(0.0, 0.0)
        .visible(false)
        .transparent(true)
        .focused(false)
        .resizable(false)
        .maximizable(false)
        .minimizable(false)
        .closable(true)
        .decorations(false)
        .skip_taskbar(true)
        .always_on_top(true)
        .shadow(false)
        .build()
        .map_err(|error| error.to_string())?;

    let _ = window.set_position(PhysicalPosition::new(base_x, y));

    state.pending_toasts.lock().unwrap().insert(label.clone(), toast.clone());

    let app_for_close = app.clone();
    window.on_window_event(move |event| {
        if matches!(event, tauri::WindowEvent::Destroyed) {
            reposition_toast_windows(&app_for_close);
        }
    });

    window.show().map_err(|error| error.to_string())?;
    let _ = window.set_position(PhysicalPosition::new(base_x, y));
    reposition_toast_windows(&app);
    Ok(())
}

#[tauri::command]
pub async fn get_toast_payload(state: State<'_, AppState>, label: String) -> Result<Option<ToastPayload>, String> {
    let pending = state.pending_toasts.lock().unwrap();
    Ok(pending.get(&label).cloned())
}

#[tauri::command]
pub async fn close_toast_window(app: AppHandle, state: State<'_, AppState>, label: String) -> Result<(), String> {
    state.pending_toasts.lock().unwrap().remove(&label);
    if let Some(window) = app.get_webview_window(&label) {
        window.close().map_err(|error| error.to_string())?;
    }
    Ok(())
}

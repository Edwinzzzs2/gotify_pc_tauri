use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Config {
    pub server_url: String,
    pub client_token: String,
    pub show_custom_notification: bool,
    pub play_sound: bool,
    pub notification_auto_hide: bool,
    pub notification_never_close: bool,
    pub notification_duration: u64,
    pub minimize_to_tray: bool,
    pub show_main_window_on_startup: bool,
    pub auto_launch: bool,
    pub enable_reconnect: bool,
    pub auto_refresh_interval: u64,
    pub bark_server_url: String,
    pub bark_forward_apps: Vec<i64>,
    pub muted_notification_apps: Vec<i64>,
    pub theme_mode: String,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            server_url: String::new(),
            client_token: String::new(),
            show_custom_notification: true,
            play_sound: true,
            notification_auto_hide: true,
            notification_never_close: false,
            notification_duration: 5000,
            minimize_to_tray: true,
            show_main_window_on_startup: true,
            auto_launch: false,
            enable_reconnect: true,
            auto_refresh_interval: 10000,
            bark_server_url: String::new(),
            bark_forward_apps: Vec::new(),
            muted_notification_apps: Vec::new(),
            theme_mode: "white".into(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct MessageItem {
    pub id: Option<i64>,
    pub date: Option<serde_json::Value>,
    pub appid: Option<i64>,
    pub appname: Option<String>,
    pub priority: Option<i64>,
    pub title: Option<String>,
    pub message: Option<String>,
    pub favorite: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct StorageMeta {
    pub path: Option<String>,
    pub locked_by_env: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct StorageChange {
    pub changed: Option<bool>,
    pub path: Option<String>,
    pub restart_required: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct InitialAppState {
    pub config: Option<Config>,
    pub messages: Option<Vec<MessageItem>>,
    pub storage: Option<StorageMeta>,
}

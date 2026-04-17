#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    gotify_tauri_lib::run();
}

import type { ThemeMode } from "./types";

export const THEME_STORAGE_KEY = "gotify-theme-mode";

export const themeLabels: Record<ThemeMode, string> = {
  white: "白色皮肤",
  black: "黑色皮肤",
};

export function getStoredThemeMode(): ThemeMode {
  if (typeof window === "undefined") {
    return "white";
  }
  return window.localStorage.getItem(THEME_STORAGE_KEY) === "black" ? "black" : "white";
}

export function applyThemeMode(mode: ThemeMode) {
  if (typeof document === "undefined") {
    return;
  }
  document.documentElement.dataset.theme = mode;
  document.documentElement.style.colorScheme = mode === "black" ? "dark" : "light";
  if (typeof window !== "undefined") {
    window.localStorage.setItem(THEME_STORAGE_KEY, mode);
  }

  // 同步更新 Tauri 原生窗口标题栏主题（黑色模式 → dark，否则 → light）
  void import("@tauri-apps/api/window")
    .then(({ getCurrentWindow }) => getCurrentWindow().setTheme(mode === "black" ? "dark" : "light"))
    .catch(() => undefined);
}

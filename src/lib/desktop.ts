import { defaultWindowIcon, getVersion } from "@tauri-apps/api/app";
import { invoke } from "@tauri-apps/api/core";
import { Image } from "@tauri-apps/api/image";
import { Menu } from "@tauri-apps/api/menu";
import { TrayIcon } from "@tauri-apps/api/tray";
import appIconUrl from "../defaultapp.png";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { disable as disableAutostart, enable as enableAutostart, isEnabled as isAutostartEnabled } from "@tauri-apps/plugin-autostart";
import { open } from "@tauri-apps/plugin-dialog";
import { requestPermission } from "@tauri-apps/plugin-notification";
import { BrowserGotifyClient } from "./gotify-client";
import {
  DEFAULT_CONFIG,
  type ApplicationInfo,
  type Config,
  type ConnectionStatus,
  type CustomToast,
  type InitialAppState,
  type MessageItem,
  type StorageChange,
  type StorageMeta,
  mergeConfig,
} from "./types";

type Listener<T> = (payload: T) => void;

function formatNotificationBody(rawText?: string) {
  const text = String(rawText || "").trim();
  if (!text) {
    return "收到一条新消息";
  }
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 6);
  const merged = lines.join("\n");
  return merged.length > 200 ? `${merged.slice(0, 200)}...` : merged;
}

export function extractVerificationCode(message: MessageItem) {
  const title = String(message.title || "");
  const body = String(message.message || "");
  if ((title.includes("验证码") || body.includes("验证码")) && /\d{4,8}/.test(body)) {
    const match = body.match(/\d{4,8}/);
    return match?.[0] || "";
  }
  return "";
}

function createTrayIconData() {
  const size = 32;
  const center = (size - 1) / 2;
  const outerRadius = 13;
  const innerRadius = 7;
  const barHalfHeight = 2;
  const barStartX = center + 1;
  const barEndX = size - 6;
  const data = new Uint8Array(size * size * 4);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const index = (y * size + x) * 4;
      const dx = x - center;
      const dy = y - center;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const inRing = distance <= outerRadius && distance >= innerRadius;
      const inBar = x >= barStartX && x <= barEndX && Math.abs(dy) <= barHalfHeight;

      if (!inRing && !inBar) {
        continue;
      }

      data[index] = 27;
      data[index + 1] = 116;
      data[index + 2] = 142;
      data[index + 3] = 255;
    }
  }

  return { data, size };
}

export class DesktopRuntime {
  private client = new BrowserGotifyClient();
  private tray: TrayIcon | null = null;
  private trayIcon: Image | null = null;
  private initialized = false;
  private setupPromise: Promise<void> | null = null;
  private isQuitting = false;
  private readonly trayId = "gotify-tray-main";
  private config: Config = { ...DEFAULT_CONFIG };
  private status: ConnectionStatus = { connected: false, status: "未连接", phase: "idle" };
  private appNames = new Map<number, string>();
  private applicationList: ApplicationInfo[] = [];
  private lastApplicationsFetchedAt = 0;
  private statusListeners = new Set<Listener<ConnectionStatus>>();
  private messageListeners = new Set<Listener<MessageItem>>();
  private openSettingsListeners = new Set<Listener<void>>();
  private messagesClearedListeners = new Set<Listener<void>>();

  constructor() {
    this.client.onStatus((payload) => {
      this.status = payload;
      this.statusListeners.forEach((listener) => listener(payload));
    });
    this.client.onMessage((payload) => {
      void this.handleIncomingMessage(payload);
    });
  }

  onConnectionStatus(listener: Listener<ConnectionStatus>) {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  onNewMessage(listener: Listener<MessageItem>) {
    this.messageListeners.add(listener);
    return () => this.messageListeners.delete(listener);
  }

  onOpenSettings(listener: Listener<void>) {
    this.openSettingsListeners.add(listener);
    return () => this.openSettingsListeners.delete(listener);
  }

  onMessagesCleared(listener: Listener<void>) {
    this.messagesClearedListeners.add(listener);
    return () => this.messagesClearedListeners.delete(listener);
  }

  async init() {
    await this.ensureRuntimeReady();

    const initialState = await invoke<InitialAppState>("load_app_state");
    const nextConfig = mergeConfig(initialState?.config);
    try {
      nextConfig.autoLaunch = await isAutostartEnabled();
    } catch {
      // ignore unsupported platforms
    }
    this.config = nextConfig;
    this.status = { connected: false, status: "未连接", phase: "idle" };

    if (this.config.serverUrl && this.config.clientToken) {
      this.client.start(this.config);
      void this.refreshApplications(this.config, true);
    }

    if (this.config.showMainWindowOnStartup) {
      await this.showMainWindow();
    }

    return {
      config: this.config,
      messages: Array.isArray(initialState?.messages) ? initialState.messages : [],
      storage: initialState?.storage || {},
    };
  }

  async getAppVersion() {
    return `v${await getVersion()}`;
  }

  getConfig() {
    return this.config;
  }

  async saveConfig(nextConfig: Config) {
    const saved = mergeConfig(await invoke<Partial<Config>>("save_config", { config: nextConfig }));
    this.config = saved;
    try {
      if (saved.autoLaunch) {
        await enableAutostart();
      } else {
        await disableAutostart();
      }
    } catch {
      // ignore unsupported platforms
    }

    this.client.stop();
    if (saved.serverUrl && saved.clientToken) {
      this.client.start(saved);
      await this.refreshApplications(saved, true);
    } else {
      this.applicationList = [];
      this.appNames.clear();
      this.lastApplicationsFetchedAt = 0;
    }
    return saved;
  }

  async testConnection(payload: { serverUrl: string; clientToken: string }) {
    const normalized = String(payload.serverUrl || "").trim().replace(/\/+$/, "");
    const token = String(payload.clientToken || "").trim();
    const url = `${normalized}/application?token=${encodeURIComponent(token)}`;
    const response = await fetch(url, { method: "GET" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }
  }

  async toggleConnection() {
    if (this.client.isConnected()) {
      this.client.stop();
      return { connected: false };
    }
    this.client.start(this.config);
    void this.refreshApplications(this.config, true);
    return { connected: true };
  }

  async getConnectionStatus() {
    return this.status;
  }

  async getMessages() {
    return invoke<MessageItem[]>("get_messages");
  }

  async clearMessages() {
    await invoke("clear_messages");
    this.messagesClearedListeners.forEach((listener) => listener());
  }

  async toggleFavorite(id: number) {
    return invoke<boolean>("toggle_favorite", { id });
  }

  async getStoragePath() {
    return invoke<StorageMeta>("get_storage_meta");
  }

  async pickStoragePath() {
    const result = await open({
      directory: true,
      multiple: false,
      title: "选择新的数据存储目录",
    });
    if (Array.isArray(result)) {
      return result[0] || "";
    }
    return result || "";
  }

  async setStoragePath(nextPath: string) {
    return invoke<StorageChange>("set_storage_path", { nextPath });
  }

  async openStoragePath() {
    await invoke("open_storage_path");
  }

  async getApplications() {
    return this.refreshApplications(this.config, false);
  }

  private async refreshApplications(config: Config, force = false) {
    const serverUrl = String(config.serverUrl || "").trim();
    const clientToken = String(config.clientToken || "").trim();
    if (!serverUrl || !clientToken) {
      this.appNames.clear();
      this.applicationList = [];
      this.lastApplicationsFetchedAt = 0;
      return this.applicationList;
    }
    if (!force && this.lastApplicationsFetchedAt && Date.now() - this.lastApplicationsFetchedAt < 15000) {
      return this.applicationList;
    }

    const normalized = serverUrl.replace(/\/+$/, "");
    const url = `${normalized}/application?token=${encodeURIComponent(clientToken)}`;
    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "X-Gotify-Key": clientToken,
        },
      });
      if (!response.ok) {
        return this.applicationList;
      }
      const data = await response.json();
      if (!Array.isArray(data)) {
        return this.applicationList;
      }
      this.applicationList = data
        .map((item) => ({ id: Number(item.id || 0), name: String(item.name || "").trim() }))
        .filter((item) => item.id > 0 && item.name);
      this.appNames = new Map(this.applicationList.map((item) => [item.id, item.name]));
      this.lastApplicationsFetchedAt = Date.now();
      return this.applicationList;
    } catch {
      return this.applicationList;
    }
  }

  private getAppNameById(appid?: number) {
    const id = Number(appid || 0);
    return this.appNames.get(id) || "";
  }

  private async handleIncomingMessage(message: MessageItem) {
    const appid = Number(message.appid || 0);
    let appname = this.getAppNameById(appid);
    if (appid && !appname) {
      await this.refreshApplications(this.config, true);
      appname = this.getAppNameById(appid);
    }

    const enriched = appname ? { ...message, appname } : message;
    await invoke("add_message", { message: enriched });
    this.messageListeners.forEach((listener) => listener(enriched));

    void this.forwardToBark(enriched, this.config);
    if (this.isPopupMutedForApp(enriched.appid)) {
      return;
    }

    if (this.config.showCustomNotification) {
      const toast: CustomToast = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        title: String(enriched.title || "Gotify 消息"),
        subtitle: String(enriched.appname || `应用 #${enriched.appid || 0}`),
        body: formatNotificationBody(String(enriched.message || "")),
        verificationCode: extractVerificationCode(enriched) || undefined,
        themeMode: this.config.themeMode,
        duration: this.config.notificationNeverClose
          ? 0
          : this.config.notificationAutoHide
            ? Math.max(1000, Number(this.config.notificationDuration) || 5000)
            : 0,
      };
      try {
        await this.showDesktopToastWindow(toast);
        return;
      } catch (error) {
        console.error("[toast] failed to show desktop toast window", error);
      }
    }

    await this.sendNativeNotification(enriched);
  }

  private async showDesktopToastWindow(toast: CustomToast) {
    await invoke("show_custom_toast", { toast });
  }

  private async sendNativeNotification(message: MessageItem) {
    if (typeof Notification === "undefined") {
      return;
    }
    if (Notification.permission !== "granted") {
      const requested = await requestPermission().catch(() => "denied");
      if (requested !== "granted") {
        return;
      }
    }

    const verificationCode = extractVerificationCode(message);
    const notification = new Notification(String(message.title || "Gotify 消息"), {
      body: `${formatNotificationBody(String(message.message || ""))}${verificationCode ? " [点击复制验证码]" : ""}`,
      silent: !this.config.playSound,
    });
    notification.onclick = async () => {
      if (verificationCode && navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(verificationCode);
        } catch {
          // ignore clipboard failures
        }
      }
      await this.showMainWindow();
      notification.close();
    };
  }

  private async forwardToBark(message: MessageItem, config: Config) {
    const barkUrl = String(config.barkServerUrl || "").trim();
    if (!barkUrl) {
      return;
    }
    const appid = Number(message.appid || 0);
    const allowedApps = Array.isArray(config.barkForwardApps) ? config.barkForwardApps : [];
    if (!allowedApps.length || !allowedApps.includes(appid)) {
      return;
    }

    const target = barkUrl.replace(/\/+$/, "");
    const title = encodeURIComponent(String(message.title || "Gotify 消息"));
    const body = encodeURIComponent(String(message.message || ""));
    const group = encodeURIComponent(String(message.appname || "Gotify"));
    const url = `${target}/${title}/${body}?group=${group}`;
    try {
      await fetch(url, { method: "GET" });
    } catch {
      // ignore bark forwarding errors
    }
  }

  private isPopupMutedForApp(appid?: number) {
    const id = Number(appid || 0);
    if (!id) {
      return false;
    }
    return Array.isArray(this.config.mutedNotificationApps) && this.config.mutedNotificationApps.includes(id);
  }

  async showMainWindow() {
    try {
      await invoke("show_main_window");
      return;
    } catch {
      // fallback to front-end window API when command is unavailable
    }

    const currentWindow = getCurrentWindow();
    await currentWindow.unminimize().catch(() => undefined);
    await currentWindow.show();
    await currentWindow.setFocus();
  }

  private async ensureRuntimeReady() {
    if (this.initialized) {
      return;
    }
    if (!this.setupPromise) {
      this.setupPromise = (async () => {
        await this.setupTray();
        await this.setupWindowBehavior();
        this.initialized = true;
      })().finally(() => {
        this.setupPromise = null;
      });
    }
    await this.setupPromise;
  }

  private async setupWindowBehavior() {
    const currentWindow = getCurrentWindow();
    await currentWindow.onCloseRequested(async (event) => {
      if (this.isQuitting) {
        return;
      }
      if (this.config.minimizeToTray) {
        event.preventDefault();
        await currentWindow.hide();
      } else {
        this.isQuitting = true;
        await invoke("quit_app");
      }
    });
  }

  private async setupTray() {
    if (this.tray) {
      return;
    }
    const icon = await this.getTrayIcon();
    const menu = await Menu.new({
      items: [
        {
          id: "show-main",
          text: "显示主界面",
          action: async () => {
            await this.showMainWindow();
          },
        },
        {
          id: "open-settings",
          text: "打开设置",
          action: async () => {
            await this.showMainWindow();
            this.openSettingsListeners.forEach((listener) => listener());
          },
        },
        {
          id: "quit-app",
          text: "退出程序",
          action: async () => {
            this.isQuitting = true;
            await invoke("quit_app");
          },
        },
      ],
    });

    const existing = await TrayIcon.getById(this.trayId).catch(() => null);
    if (existing) {
      this.tray = existing;
      await this.tray.setMenu(menu);
      await this.tray.setTooltip("Gotify 客户端");
      await this.tray.setShowMenuOnLeftClick(false);
      if (icon) {
        await this.tray.setIcon(icon);
      }
      return;
    }

    this.tray = await TrayIcon.new({
      id: this.trayId,
      menu,
      showMenuOnLeftClick: false,
      tooltip: "Gotify 客户端",
      icon: icon || undefined,
      action: async (event) => {
        const isLeftClick =
          (event.type === "Click" && event.button === "Left" && event.buttonState === "Up") ||
          (event.type === "DoubleClick" && event.button === "Left");
        if (isLeftClick) {
          await this.showMainWindow();
        }
      },
    });
  }

  private async getTrayIcon() {
    if (this.trayIcon) {
      return this.trayIcon;
    }

    // 用 Canvas 将 PNG URL 解码为 32x32 RGBA 原始像素，再传给 Image.new()
    try {
      const icon = await new Promise<import("@tauri-apps/api/image").Image | null>((resolve) => {
        const img = new window.Image();
        img.onload = () => {
          try {
            const size = 32;
            const canvas = document.createElement("canvas");
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext("2d");
            if (!ctx) { resolve(null); return; }
            ctx.drawImage(img, 0, 0, size, size);
            const rgba = new Uint8Array(ctx.getImageData(0, 0, size, size).data.buffer);
            Image.new(rgba, size, size).then(resolve).catch(() => resolve(null));
          } catch {
            resolve(null);
          }
        };
        img.onerror = () => resolve(null);
        img.src = appIconUrl;
      });
      if (icon) {
        this.trayIcon = icon;
        return icon;
      }
    } catch {
      // ignore
    }

    // Fallback：使用 Tauri 内置窗口图标
    try {
      const icon = await defaultWindowIcon();
      if (icon) {
        this.trayIcon = icon;
        return icon;
      }
    } catch {
      // ignore
    }

    return null;
  }

  stop() {
    this.client.stop();
  }
}

export const desktopRuntime = new DesktopRuntime();

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    desktopRuntime.stop();
    void TrayIcon.removeById("gotify-tray-main").catch(() => undefined);
  });
}

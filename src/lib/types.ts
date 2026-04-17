export type ThemeMode = "white" | "black";

export const DEFAULT_CONFIG = {
  serverUrl: "",
  clientToken: "",
  showCustomNotification: true,
  playSound: true,
  notificationAutoHide: true,
  notificationNeverClose: false,
  notificationDuration: 5000,
  minimizeToTray: true,
  showMainWindowOnStartup: true,
  autoLaunch: false,
  enableReconnect: true,
  autoRefreshInterval: 10000,
  barkServerUrl: "",
  barkForwardApps: [] as number[],
  mutedNotificationApps: [] as number[],
  themeMode: "white" as ThemeMode,
};

export type Config = typeof DEFAULT_CONFIG;

export type ApplicationInfo = {
  id: number;
  name: string;
};

export type MessageItem = {
  id?: number;
  date?: string | number;
  appid?: number;
  appname?: string;
  priority?: number;
  title?: string;
  message?: string;
  favorite?: boolean;
};

export type StorageMeta = {
  path?: string;
  lockedByEnv?: boolean;
};

export type StorageChange = {
  changed?: boolean;
  path?: string;
  restartRequired?: boolean;
};

export type ConnectionStatus = {
  connected?: boolean;
  status?: string;
  phase?: "idle" | "connecting" | "online" | "reconnecting" | "error";
};

export type SettingsNotice = {
  text: string;
  type: "info" | "error";
};

export type CustomToast = {
  id: string;
  title: string;
  subtitle: string;
  body: string;
  verificationCode?: string;
  duration: number;
  themeMode?: string;
};

export type InitialAppState = {
  config?: Partial<Config>;
  messages?: MessageItem[];
  storage?: StorageMeta;
};

export function mergeConfig(config?: Partial<Config> | null): Config {
  return { ...DEFAULT_CONFIG, ...(config || {}) };
}



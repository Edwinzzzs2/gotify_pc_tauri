import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { CustomToastCard } from "@/components/CustomToast";
import { MessageCard } from "@/components/MessageCard";
import { SettingsModal } from "@/components/SettingsModal";
import { desktopRuntime } from "@/lib/desktop";
import { applyThemeMode, getStoredThemeMode } from "@/lib/theme";
import {
  DEFAULT_CONFIG,
  type ApplicationInfo,
  type Config,
  type ConnectionStatus,
  type CustomToast,
  type MessageItem,
  type SettingsNotice,
  mergeConfig,
} from "@/lib/types";
import { getCurrentWindow } from "@tauri-apps/api/window";

const isToastWindow = getCurrentWindow().label.startsWith("toast");

function formatDate(value?: string | number) {
  if (value === undefined || value === null) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function ToastWindowApp() {
  const [toast, setToast] = useState<CustomToast | null>(null);

  useEffect(() => {
    document.body.classList.add("toast-window-mode");
    const currentWindow = getCurrentWindow();
    let timer: number | undefined;

    const closeSelf = async () => {
      if (timer) {
        window.clearTimeout(timer);
        timer = undefined;
      }
      setToast(null);
      await invoke("close_toast_window", { label: currentWindow.label }).catch(() => undefined);
    };

    const setup = async () => {
      let payload: CustomToast | null = null;
      for (let i = 0; i < 8; i += 1) {
        payload = await invoke<CustomToast | null>("get_toast_payload", { label: currentWindow.label }).catch(() => null);
        if (payload) {
          break;
        }
        await new Promise((resolve) => window.setTimeout(resolve, 40));
      }
      if (!payload) {
        void closeSelf();
        return () => undefined;
      }
      if (payload.themeMode) {
        document.documentElement.setAttribute("data-theme", payload.themeMode);
      } else {
        document.documentElement.setAttribute("data-theme", "white");
      }
      setToast(payload);
      if (payload.duration > 0) {
        timer = window.setTimeout(() => {
          void closeSelf();
        }, payload.duration);
      }
      return () => undefined;
    };

    let cleanup = () => undefined;
    void setup().then((unlisten) => {
      cleanup = unlisten;
    });

    return () => {
      cleanup();
      if (timer) {
        window.clearTimeout(timer);
      }
      document.body.classList.remove("toast-window-mode");
    };
  }, []);

  const closeToast = async () => {
    await invoke("close_toast_window", { label: getCurrentWindow().label }).catch(() => undefined);
  };

  const activateToast = async () => {
    await invoke("show_main_window").catch(() => undefined);
    await closeToast();
  };

  const copyCode = async (code: string) => {
    if (!code) {
      return;
    }
    await navigator.clipboard.writeText(code).catch(() => undefined);
  };

  return (
    <div className="toast-window-shell">
      {toast ? <CustomToastCard toast={toast} onClose={() => void closeToast()} onCopyCode={(code) => void copyCode(code)} onActivate={() => void activateToast()} /> : null}
    </div>
  );
}

function MainApp() {
  const [config, setConfig] = useState<Config>({ ...DEFAULT_CONFIG, themeMode: getStoredThemeMode() });
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>({ connected: false, status: "未连接", phase: "idle" });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [banner, setBanner] = useState("");
  const [settingsNotice, setSettingsNotice] = useState<SettingsNotice>({ text: "", type: "info" });
  const [storagePath, setStoragePath] = useState("");
  const [draftStoragePath, setDraftStoragePath] = useState("");
  const [applyingStoragePath, setApplyingStoragePath] = useState(false);
  const [applications, setApplications] = useState<ApplicationInfo[]>([]);
  const [selectedAppId, setSelectedAppId] = useState("all");
  const [searchText, setSearchText] = useState("");
  const [showFavorites, setShowFavorites] = useState(false);
  const [appVersion, setAppVersion] = useState("-");

  useEffect(() => {
    applyThemeMode(config.themeMode);
  }, [config.themeMode]);

  useEffect(() => {
    if (settingsOpen) {
      setSettingsNotice({ text: "", type: "info" });
    }
  }, [settingsOpen]);

  useEffect(() => {
    let active = true;
    let unsubStatus = () => undefined;
    let unsubMessage = () => undefined;
    let unsubOpenSettings = () => undefined;
    let unsubMessagesCleared = () => undefined;

    const run = async () => {
      try {
        unsubStatus = desktopRuntime.onConnectionStatus((payload) => active && setStatus(payload));
        unsubMessage = desktopRuntime.onNewMessage((payload) => active && setMessages((prev) => [payload, ...prev]));
        unsubOpenSettings = desktopRuntime.onOpenSettings(() => active && setSettingsOpen(true));
        unsubMessagesCleared = desktopRuntime.onMessagesCleared(() => active && setMessages([]));

        const initialState = await desktopRuntime.init();
        const [version, apps] = await Promise.all([
          desktopRuntime.getAppVersion(),
          desktopRuntime.getApplications(),
        ]);

        if (!active) {
          return;
        }

        const nextConfig = mergeConfig(initialState.config);
        setConfig(nextConfig);
        setMessages(Array.isArray(initialState.messages) ? initialState.messages : []);
        const nextStoragePath = String(initialState.storage?.path || "");
        setStoragePath(nextStoragePath);
        setDraftStoragePath(nextStoragePath);
        setAppVersion(version);
        setApplications(Array.isArray(apps) ? apps : []);
        setStatus(await desktopRuntime.getConnectionStatus());
      } catch (error) {
        if (active) {
          setBanner(`初始化失败: ${error instanceof Error ? error.message : "未知错误"}`);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void run();

    return () => {
      active = false;
      unsubStatus();
      unsubMessage();
      unsubOpenSettings();
      unsubMessagesCleared();
    };
  }, []);

  useEffect(() => {
    if (!banner) {
      return undefined;
    }
    const timer = window.setTimeout(() => setBanner(""), 3000);
    return () => window.clearTimeout(timer);
  }, [banner]);

  const statusClass = status.phase === "online"
    ? "online"
    : status.phase === "connecting"
      ? "connecting"
      : status.phase === "reconnecting"
        ? "reconnecting"
        : status.phase === "error"
          ? "offline"
          : "idle";

  const appIdSet = useMemo(() => new Set(messages.map((item) => Number(item.appid || 0)).filter((id) => id > 0)), [messages]);

  const applicationOptions = useMemo(() => {
    const knownIds = new Set(applications.map((item) => item.id));
    const dynamicOptions = Array.from(appIdSet)
      .filter((id) => !knownIds.has(id))
      .map((id) => ({ id: String(id), name: `应用 #${id}` }));
    return [{ id: "all", name: "全部分组" }, ...applications.map((item) => ({ id: String(item.id), name: item.name })), ...dynamicOptions];
  }, [applications, appIdSet]);

  const visibleMessages = useMemo(() => {
    let result = messages;
    if (showFavorites) {
      result = result.filter((item) => item.favorite);
    }
    if (selectedAppId !== "all") {
      result = result.filter((item) => String(item.appid) === selectedAppId);
    }
    const keyword = searchText.trim().toLowerCase();
    if (keyword) {
      result = result.filter(
        (item) =>
          String(item.title || "").toLowerCase().includes(keyword) ||
          String(item.message || "").toLowerCase().includes(keyword)
      );
    }
    return result;
  }, [messages, searchText, selectedAppId, showFavorites]);

  const favoriteCount = useMemo(() => messages.filter((item) => item.favorite).length, [messages]);

  const getAppLabel = (appid?: number) => {
    const id = Number(appid || 0);
    if (!id) {
      return "应用";
    }
    return applications.find((item) => item.id === id)?.name || `应用 #${id}`;
  };

  const handleToggleConnection = async () => {
    try {
      await desktopRuntime.toggleConnection();
    } catch {
      // ignore
    }
  };

  const refreshApplications = async () => {
    const apps = await desktopRuntime.getApplications();
    setApplications(Array.isArray(apps) ? apps : []);
  };

  const onSave = async () => {
    setSaving(true);
    try {
      const wait = new Promise((resolve) => window.setTimeout(resolve, 400));
      const [saved] = await Promise.all([desktopRuntime.saveConfig(config), wait]);
      setConfig(saved);
      setSettingsNotice({ text: "设置已保存，正在应用新的桌面行为", type: "info" });
      await refreshApplications();
      setSettingsOpen(false);
    } catch (error) {
      setSettingsNotice({ text: `保存失败: ${error instanceof Error ? error.message : "未知错误"}`, type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const onTest = async () => {
    const serverUrl = String(config.serverUrl || "").trim();
    const clientToken = String(config.clientToken || "").trim();
    if (!serverUrl) {
      setSettingsNotice({ text: "请先填写服务器地址", type: "error" });
      return;
    }
    setTesting(true);
    try {
      const wait = new Promise((resolve) => window.setTimeout(resolve, 400));
      await Promise.all([desktopRuntime.testConnection({ serverUrl, clientToken }), wait]);
      setSettingsNotice({ text: "连接测试成功", type: "info" });
    } catch (error) {
      setSettingsNotice({ text: `连接测试失败: ${error instanceof Error ? error.message : "未知错误"}`, type: "error" });
    } finally {
      setTesting(false);
    }
  };

  const onClearMessages = async () => {
    const previousMessages = messages;
    setMessages([]);
    setClearing(true);
    try {
      await desktopRuntime.clearMessages();
      setBanner("消息已清空");
    } catch {
      setMessages(previousMessages);
      setBanner("清空失败，请重试");
    } finally {
      setClearing(false);
    }
  };

  const onPickStoragePath = async () => {
    try {
      const selected = await desktopRuntime.pickStoragePath();
      if (selected) {
        setDraftStoragePath(selected);
      }
    } catch (error) {
      setSettingsNotice({ text: `选择目录失败: ${error instanceof Error ? error.message : "未知错误"}`, type: "error" });
    }
  };

  const onApplyStoragePath = async () => {
    setApplyingStoragePath(true);
    try {
      const result = await desktopRuntime.setStoragePath(draftStoragePath);
      const nextPath = String(result.path || draftStoragePath);
      setStoragePath(nextPath);
      setDraftStoragePath(nextPath);
      const text = result.restartRequired ? "存储目录已更新，后续保存会写入新位置" : "存储目录未变化";
      setSettingsNotice({ text, type: "info" });
      setBanner(text);
    } catch (error) {
      const text = `更新存储目录失败: ${error instanceof Error ? error.message : "未知错误"}`;
      setSettingsNotice({ text, type: "error" });
      setBanner(text);
    } finally {
      setApplyingStoragePath(false);
    }
  };

  const onToggleFavorite = async (id: number) => {
    try {
      const favorite = await desktopRuntime.toggleFavorite(id);
      setMessages((prev) => prev.map((item) => (item.id === id ? { ...item, favorite } : item)));
    } catch {
      setBanner("收藏操作失败，请重试");
    }
  };

  if (loading) {
    return (
      <div className="app-shell">
        <div className="app-panel message-panel flat-layout" style={{ justifyContent: "center", alignItems: "center" }}>
          <div className="brand-title" style={{ marginTop: 12 }}>正在初始化客户端...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <section className="main-grid">
        <div className="app-panel message-panel flat-layout">
          <div className="toolbar flat-toolbar">
            <div className="header-tabs">
              <button type="button" className={`header-tab ${!showFavorites ? "active" : ""}`} onClick={() => setShowFavorites(false)}>历史消息</button>
              <button type="button" className={`header-tab ${showFavorites ? "active" : ""}`} onClick={() => setShowFavorites(true)}>我的收藏</button>
            </div>
            <div className="header-actions-right">
              <div className="search-box">
                <input className="text-input flat-input" value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="搜索消息..." />
                {searchText ? <button type="button" className="clear-search" onClick={() => setSearchText("")}>×</button> : null}
              </div>
              <select className="select-input flat-input" value={selectedAppId} onChange={(event) => setSelectedAppId(event.target.value)}>
                {applicationOptions.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
              <div className="count-text">{visibleMessages.length} 条消息</div>
            </div>
          </div>

          {banner ? <div className="banner">{banner}</div> : null}

          <div className="message-list">
            {visibleMessages.length === 0 ? (
              <div className="empty-state">当前没有符合条件的消息</div>
            ) : (
              visibleMessages.map((item) => (
                <MessageCard key={`${item.id}-${item.date}`} item={item} appLabel={getAppLabel(item.appid)} onToggleFavorite={onToggleFavorite} formatDate={formatDate} />
              ))
            )}
          </div>

          <div className="footer-panel flat-footer">
            <div className="footer-bar">
              <div className="footer-meta">
                <div className="status-indicator">
                  <span className={`status-dot ${statusClass}`}></span>
                  <span className="status-text-label">{status.status || "未连接"}</span>
                </div>
              </div>
              <div className="footer-actions">
                <button type="button" className="flat-button secondary-button" onClick={handleToggleConnection}>
                  {status.phase === "online" || status.phase === "reconnecting" || status.phase === "connecting" ? "断开" : "连接"}
                </button>
                <button type="button" className="flat-button secondary-button" onClick={() => setSettingsOpen(true)}>设置</button>
                <button type="button" className="flat-button danger-button" onClick={onClearMessages} disabled={visibleMessages.length === 0 || clearing}>{clearing ? "..." : "清空消息"}</button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        config={config}
        appVersion={appVersion}
        applications={applications}
        setConfig={setConfig}
        onSave={onSave}
        onTest={onTest}
        testing={testing}
        saving={saving}
        notice={settingsNotice}
        storagePath={storagePath}
        draftStoragePath={draftStoragePath}
        setDraftStoragePath={setDraftStoragePath}
        onPickStoragePath={onPickStoragePath}
        onApplyStoragePath={onApplyStoragePath}
        onOpenStoragePath={() => void desktopRuntime.openStoragePath()}
        applyingStoragePath={applyingStoragePath}
      />
    </div>
  );
}

export default function App() {
  return isToastWindow ? <ToastWindowApp /> : <MainApp />;
}

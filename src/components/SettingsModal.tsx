import type { Dispatch, SetStateAction } from "react";
import { themeLabels } from "@/lib/theme";
import type { ApplicationInfo, Config, SettingsNotice } from "@/lib/types";

type SettingsModalProps = {
  open: boolean;
  onClose: () => void;
  config: Config;
  appVersion: string;
  applications: ApplicationInfo[];
  setConfig: Dispatch<SetStateAction<Config>>;
  onSave: () => void;
  onTest: () => void;
  testing: boolean;
  saving: boolean;
  notice: SettingsNotice;
  storagePath: string;
  draftStoragePath: string;
  setDraftStoragePath: Dispatch<SetStateAction<string>>;
  onPickStoragePath: () => void;
  onApplyStoragePath: () => void;
  onOpenStoragePath: () => void;
  applyingStoragePath: boolean;
};

export function SettingsModal({
  open,
  onClose,
  config,
  appVersion,
  applications,
  setConfig,
  onSave,
  onTest,
  testing,
  saving,
  notice,
  storagePath,
  draftStoragePath,
  setDraftStoragePath,
  onPickStoragePath,
  onApplyStoragePath,
  onOpenStoragePath,
  applyingStoragePath,
}: SettingsModalProps) {
  if (!open) {
    return null;
  }

  const toggleNumberList = (key: "mutedNotificationApps" | "barkForwardApps", id: number) => {
    setConfig((prev) => {
      const current = Array.isArray(prev[key]) ? prev[key] : [];
      if (current.includes(id)) {
        return { ...prev, [key]: current.filter((item) => item !== id) };
      }
      return { ...prev, [key]: [...current, id] };
    });
  };

  return (
    <div className="modal-shell">
      <div className="modal-backdrop" onClick={onClose}></div>
      <div className="modal-card">
        <div className="modal-header">
          <span>Gotify 客户端设置</span>
          <span className="modal-version">{appVersion || "-"}</span>
        </div>
        <div className="modal-body">
          <section className="section-card">
            <div className="section-title">服务器连接</div>
            <div className="form-grid">
              <div className="form-row compact">
                <div className="field-label">服务器地址</div>
                <input
                  className="text-input"
                  value={config.serverUrl}
                  onChange={(event) => setConfig((prev) => ({ ...prev, serverUrl: event.target.value }))}
                  placeholder="https://your-gotify.example.com"
                />
              </div>
              <div className="form-row compact">
                <div className="field-label">客户端令牌</div>
                <input
                  type="password"
                  className="text-input"
                  value={config.clientToken}
                  onChange={(event) => setConfig((prev) => ({ ...prev, clientToken: event.target.value }))}
                  placeholder="Client Token"
                />
              </div>
            </div>
          </section>

          <section className="section-card">
            <div className="section-title">通知设置</div>
            <div className="checkbox-grid">
              <label className="checkbox-item">
                <input
                  type="checkbox"
                  checked={config.showCustomNotification}
                  onChange={(event) => setConfig((prev) => ({ ...prev, showCustomNotification: event.target.checked }))}
                />
                <span>启用弹窗卡片</span>
              </label>
              <label className="checkbox-item">
                <input type="checkbox" checked={config.playSound} onChange={(event) => setConfig((prev) => ({ ...prev, playSound: event.target.checked }))} />
                <span>播放提示音</span>
              </label>
              <label className="checkbox-item">
                <input type="checkbox" checked={config.enableReconnect} onChange={(event) => setConfig((prev) => ({ ...prev, enableReconnect: event.target.checked }))} />
                <span>启用主动重连</span>
              </label>
              <label className="checkbox-item">
                <input
                  type="checkbox"
                  checked={config.notificationAutoHide}
                  onChange={(event) =>
                    setConfig((prev) => ({
                      ...prev,
                      notificationAutoHide: event.target.checked,
                      notificationNeverClose: event.target.checked ? false : prev.notificationNeverClose,
                    }))
                  }
                />
                <span>提示自动消失</span>
              </label>
              <label className="checkbox-item">
                <input
                  type="checkbox"
                  checked={config.notificationNeverClose}
                  onChange={(event) =>
                    setConfig((prev) => ({
                      ...prev,
                      notificationNeverClose: event.target.checked,
                      notificationAutoHide: event.target.checked ? false : prev.notificationAutoHide,
                    }))
                  }
                />
                <span>永不自动关闭</span>
              </label>
            </div>
            <div className="form-row compact" style={{ marginTop: 12 }}>
              <div className="field-label">持续时间(毫秒)</div>
              <input
                className="number-input"
                type="number"
                min={1000}
                step={1000}
                value={config.notificationDuration}
                disabled={!config.notificationAutoHide || config.notificationNeverClose}
                onChange={(event) => setConfig((prev) => ({ ...prev, notificationDuration: Number(event.target.value || 0) }))}
              />
            </div>
            <div style={{ marginTop: 16 }}>
              <div className="field-label">屏蔽弹窗分组</div>
              <div className="group-list" style={{ marginTop: 10 }}>
                {applications.length === 0 ? (
                  <div className="empty-text">暂无分组，请先连接服务器</div>
                ) : (
                  <div className="checkbox-grid">
                    {applications.map((app) => (
                      <label key={app.id} className="checkbox-item">
                        <input type="checkbox" checked={config.mutedNotificationApps.includes(app.id)} onChange={() => toggleNumberList("mutedNotificationApps", app.id)} />
                        <span>{app.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <div className="field-hint" style={{ marginTop: 8 }}>选中的分组仍会入历史记录，但不再弹出提示。</div>
            </div>
          </section>

          <section className="section-card">
            <div className="section-title">Bark 转发</div>
            <div className="form-grid">
              <div className="form-row compact">
                <div className="field-label">Bark 地址</div>
                <input
                  className="text-input"
                  value={config.barkServerUrl}
                  onChange={(event) => setConfig((prev) => ({ ...prev, barkServerUrl: event.target.value }))}
                  placeholder="https://api.day.app/YOUR_KEY"
                />
              </div>
              <div>
                <div className="field-label">允许转发的分组</div>
                <div className="group-list" style={{ marginTop: 10 }}>
                  {applications.length === 0 ? (
                    <div className="empty-text">暂无分组，请先连接服务器</div>
                  ) : (
                    <div className="checkbox-grid">
                      {applications.map((app) => (
                        <label key={app.id} className="checkbox-item">
                          <input type="checkbox" checked={config.barkForwardApps.includes(app.id)} onChange={() => toggleNumberList("barkForwardApps", app.id)} />
                          <span>{app.name}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className="section-card">
            <div className="section-title">存储目录</div>
            <div className="storage-value">{storagePath || "-"}</div>
            <div className="field-hint" style={{ marginTop: 8 }}>如果需要迁移数据，程序会把配置和历史消息复制到新目录。</div>
            <div className="form-row" style={{ marginTop: 12 }}>
              <div className="field-label">新目录</div>
              <input className="text-input" value={draftStoragePath} onChange={(event) => setDraftStoragePath(event.target.value)} placeholder="选择或输入新的目录路径" />
              <button type="button" className="secondary-button" onClick={onPickStoragePath}>选择目录</button>
            </div>
            <div className="footer-actions" style={{ marginTop: 12 }}>
              <button type="button" className="secondary-button" onClick={onOpenStoragePath} disabled={!storagePath}>打开当前目录</button>
              <button type="button" className="secondary-button" onClick={onApplyStoragePath} disabled={applyingStoragePath}>{applyingStoragePath ? "应用中..." : "应用新目录"}</button>
            </div>
          </section>

          <section className="section-card">
            <div className="section-title">外观与行为</div>
            <div className="theme-picker">
              {(["white", "black"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={`theme-tile ${config.themeMode === mode ? "active" : ""}`}
                  onClick={() => setConfig((prev) => ({ ...prev, themeMode: mode }))}
                >
                  <div style={{ fontWeight: 700 }}>{themeLabels[mode]}</div>
                  <div className="field-hint" style={{ marginTop: 6 }}>{mode === "white" ? "清爽、明亮、纸感白" : "沉稳、专注、黑曜石风格"}</div>
                  <div className={`theme-preview ${mode}`}></div>
                </button>
              ))}
            </div>
            <div className="checkbox-grid" style={{ marginTop: 16 }}>
              <label className="checkbox-item">
                <input type="checkbox" checked={config.minimizeToTray} onChange={(event) => setConfig((prev) => ({ ...prev, minimizeToTray: event.target.checked }))} />
                <span>关闭窗口时缩小到任务栏</span>
              </label>
              <label className="checkbox-item">
                <input type="checkbox" checked={config.autoLaunch} onChange={(event) => setConfig((prev) => ({ ...prev, autoLaunch: event.target.checked }))} />
                <span>开机自动启动</span>
              </label>
              <label className="checkbox-item">
                <input type="checkbox" checked={config.showMainWindowOnStartup} onChange={(event) => setConfig((prev) => ({ ...prev, showMainWindowOnStartup: event.target.checked }))} />
                <span>启动时显示主界面</span>
              </label>
            </div>
          </section>
        </div>
        <div className="modal-footer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            {notice.text ? (
              <div className={`notice-text ${notice.type}`} style={{ fontSize: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
                {notice.type === "info" ? (
                  notice.text === "连接测试成功" ? (
                    <span className="status-dot online" style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "var(--success-color)", display: "inline-block" }}></span>
                  ) : (
                    <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                  )
                ) : (
                  <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                )}
                {notice.text}
              </div>
            ) : null}
          </div>
          <div className="footer-actions" style={{ display: "flex", gap: "8px" }}>
            <button type="button" className="secondary-button" onClick={onTest} disabled={testing}>{testing ? "正在测试..." : "测试连接"}</button>
            <button type="button" className="ghost-button" onClick={onClose} disabled={saving}>关闭</button>
            <button type="button" className="primary-button" onClick={onSave} disabled={saving}>{saving ? "正在保存..." : "保存设置"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}



import { useState } from "react";
import type { CustomToast } from "@/lib/types";
import appIconUrl from "../defaultapp.png";

type CustomToastProps = {
  toast: CustomToast;
  onClose: (id: string) => void;
  onCopyCode: (code: string) => void;
  onActivate?: () => void;
};

export function CustomToastCard({ toast, onClose, onCopyCode, onActivate }: CustomToastProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (event: React.MouseEvent) => {
    event.stopPropagation();
    onCopyCode(toast.verificationCode || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={`feishu-toast ${onActivate ? "clickable" : ""}`}
      role="status"
      aria-live="polite"
      onClick={onActivate}
    >
      <div className="feishu-toast-avatar">
        <img src={appIconUrl} alt="icon" className="feishu-toast-avatar-img" />
      </div>

      <div className="feishu-toast-body">
        <div className="feishu-toast-row1">
          <div className="feishu-toast-title-group">
            <span className="feishu-toast-title" title={toast.title}>
              {toast.title || "Gotify消息"}
            </span>
            {toast.subtitle && (
              <span className="feishu-toast-subtitle" title={toast.subtitle}>
                {toast.subtitle}
              </span>
            )}
          </div>
          {toast.verificationCode && (
            <button
              type="button"
              className={`feishu-toast-copy-btn ${copied ? "copied" : ""}`}
              onClick={handleCopy}
              title="点击复制验证码"
            >
              {copied ? "复制成功" : "复制验证码"}
            </button>
          )}
        </div>

        <div className="feishu-toast-row2" title={toast.body}>
          {toast.body}
        </div>
      </div>

      <button
        type="button"
        className="feishu-toast-close"
        onClick={(event) => {
          event.stopPropagation();
          onClose(toast.id);
        }}
        aria-label="关闭通知"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="1.2" fill="none">
          <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}

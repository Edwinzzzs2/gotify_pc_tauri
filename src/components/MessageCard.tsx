import { useMemo, useState } from "react";
import type { MessageItem } from "@/lib/types";

type MessageCardProps = {
  item: MessageItem;
  appLabel?: string;
  onToggleFavorite: (id: number) => void;
  formatDate: (value?: string | number) => string;
};

function extractVerificationCode(title: string, body: string) {
  if ((title.includes("验证码") || body.includes("验证码")) && /\d{4,8}/.test(body)) {
    const match = body.match(/\d{4,8}/);
    return match?.[0] || "";
  }
  return "";
}

export function MessageCard({ item, appLabel, onToggleFavorite, formatDate }: MessageCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const rawMessage = String(item.message || "");
  const lines = rawMessage.split("\n");
  const maxLines = 4;
  const maxChars = 220;
  const overLineLimit = lines.length > maxLines;
  const overCharLimit = rawMessage.length > maxChars;
  const canCollapse = overLineLimit || overCharLimit;
  const collapsedText = useMemo(() => {
    const merged = lines.slice(0, maxLines).join("\n");
    if (merged.length <= maxChars) {
      return overLineLimit ? `${merged}...` : merged;
    }
    return `${merged.slice(0, maxChars)}...`;
  }, [rawMessage, overLineLimit]);

  const visibleMessage = expanded || !canCollapse ? rawMessage : collapsedText;
  const priorityColor = item.priority && item.priority >= 8 ? "#ef4444" : item.priority && item.priority >= 4 ? "#3b82f6" : "#22c55e";

  const code = extractVerificationCode(String(item.title || ""), rawMessage);

  const copyCode = async (event: React.MouseEvent) => {
    event.stopPropagation();
    if (code) {
      await navigator.clipboard.writeText(code).catch(() => undefined);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="message-card">
      <div className="message-priority" style={{ backgroundColor: priorityColor }}></div>
      <div className="message-content">
        {/* Row 1: Title + meta */}
        <div className="message-row1">
          <div className="message-title-group">
            <div className="message-title">{item.title || "无标题"}</div>
            {code ? (
              <button
                type="button"
                className={`captcha-button ${copied ? "copied" : ""}`}
                onClick={copyCode}
                title="点击复制验证码"
              >
                <svg viewBox="0 0 24 24" width="11" height="11" stroke="currentColor" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
                {copied ? "已复制" : "复制验证码"}
              </button>
            ) : null}
          </div>
          <div className="message-row1-right">
            <span className="message-app-tag">{appLabel || `应用 #${item.appid || 0}`}</span>
            <button
              type="button"
              className={`message-star ${item.favorite ? "active" : ""}`}
              title={item.favorite ? "取消收藏" : "收藏"}
              onClick={() => item.id && onToggleFavorite(item.id)}
            >
              <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill={item.favorite ? "currentColor" : "none"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
              </svg>
            </button>
            <span className="message-time">{formatDate(item.date)}</span>
          </div>
        </div>

        {/* Row 2: Body */}
        <div className="message-body">{visibleMessage}</div>

        {/* Row 3: Expand only */}
        {canCollapse ? (
          <div className="message-actions-row">
            <button type="button" className="link-button" onClick={() => setExpanded((prev) => !prev)}>
              {expanded ? "收起" : "展开"}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

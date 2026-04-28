const VERIFICATION_CODE_RE = /\d{4,8}/;

export function extractVerificationCode(title: string, body: string) {
  const sourceTitle = String(title || "");
  const sourceBody = String(body || "");

  if ((sourceTitle.includes("验证码") || sourceBody.includes("验证码")) && VERIFICATION_CODE_RE.test(sourceBody)) {
    return sourceBody.match(VERIFICATION_CODE_RE)?.[0] || "";
  }
  return "";
}

export function getPinnedPreviewText(body: string) {
  const compact = String(body || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" / ");

  if (!compact) {
    return "暂无内容";
  }
  return compact.length > 180 ? `${compact.slice(0, 180)}...` : compact;
}

export function isPinActive(pinnedUntil?: number) {
  return Number(pinnedUntil || 0) > Date.now();
}

export function getNextLocalMidnightMs() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

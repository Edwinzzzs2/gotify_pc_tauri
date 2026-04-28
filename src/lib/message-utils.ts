const VERIFICATION_CODE_RE = /\d{4,8}/;

export function extractVerificationCode(title: string, body: string) {
  const sourceTitle = String(title || "");
  const sourceBody = String(body || "");
  const lines = sourceBody.split("\n").map((line) => line.trim()).filter(Boolean);

  // 今日登录验证码里常有多组环境码，优先取新零帮相关行，避免复制到 iDaaS 环境码。
  const preferredLine = lines.find((line) => line.includes("新零帮") && VERIFICATION_CODE_RE.test(line));
  if (preferredLine) {
    return preferredLine.match(VERIFICATION_CODE_RE)?.[0] || "";
  }

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
